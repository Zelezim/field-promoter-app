/**
 * Deterministic shelf audit used by the PWA (offline) and by the server
 * function when AI_PROVIDER is not "openai". One implementation, two callers.
 * The photo is accepted and flagged, but the mock scores the counts — it does
 * not pretend to see pixels. The OpenAI path is the one that reads the image.
 */

export const DEFAULT_DAILY_QUOTA = 20;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function text(locale, en, pt) {
  return locale === "pt" ? pt : en;
}

function defectDetail(locale, kind, name, reason, facings, target) {
  if (kind === "stockout") {
    const reasonText = {
      supplier: text(locale, "the last order arrived short", "o último pedido chegou incompleto"),
      shelf: text(locale, "the shelf is empty", "a gôndola está vazia"),
      phantom: text(locale, "the book stock does not match the shelf", "o estoque do sistema não bate com a gôndola"),
      price: text(locale, "the price cannot be read", "o preço não está visível"),
      expiry: text(locale, "the units on display are short-dated or expired", "há unidades vencidas ou com prazo curto"),
      space: text(locale, "the facing was lost to another brand", "o espaço foi perdido para outra marca"),
      no_order: text(locale, "the store did not reorder", "a loja não fez o pedido"),
    }[reason] || text(locale, "the shelf is empty", "a gôndola está vazia");
    return text(
      locale,
      `${name}: out of stock because ${reasonText}.`,
      `${name}: ruptura porque ${reasonText}.`,
    );
  }
  return text(
    locale,
    `${name}: ${facings} facings on the shelf, planogram asks for ${target}.`,
    `${name}: ${facings} frentes na gôndola, o planograma pede ${target}.`,
  );
}

export function buildMockAudit(input) {
  const locale = input.locale === "pt" ? "pt" : "en";
  const products = input.products || [];
  const bySku = Object.fromEntries(products.map((product) => [product.sku, product]));
  const counts = input.counts || [];
  const stockouts = input.stockouts || [];
  const reasonBySku = new Map(stockouts.map((row) => [row.sku, row.reason]));

  const defects = [];
  const opportunities = [];
  let facingSum = 0;
  let facingN = 0;

  for (const count of counts) {
    const product = bySku[count.sku];
    const target = product?.facings ?? 4;
    const facings = Number(count.facings ?? 0);
    const onHand = Number(count.onHand ?? 0);
    facingSum += target > 0 ? Math.min(facings / target, 1) : 1;
    facingN += 1;
    const name = (locale === "en" && product?.nameEn) || product?.name || count.sku;

    if (onHand <= 0 || reasonBySku.has(count.sku)) {
      defects.push({
        sku: count.sku,
        name,
        type: "stockout",
        severity: "high",
        reason: reasonBySku.get(count.sku) || "shelf",
        detail: defectDetail(locale, "stockout", name, reasonBySku.get(count.sku) || "shelf"),
      });
    } else if (facings < target) {
      defects.push({
        sku: count.sku,
        name,
        type: "facing",
        severity: facings * 2 <= target ? "medium" : "low",
        detail: defectDetail(locale, "facing", name, null, facings, target),
      });
    }

    if (product && product.shelfLifeDays <= 30 && onHand > 0) {
      opportunities.push({
        sku: count.sku,
        name,
        type: "fefo",
        detail: text(
          locale,
          `${name} has a short shelf life. Keep the older estimate in front.`,
          `${name} tem vida de prateleira curta. Deixe a estimativa mais antiga na frente.`,
        ),
      });
    }
    if (product?.category === "requeijao" && onHand > 0) {
      opportunities.push({
        sku: count.sku,
        name,
        type: "secondary_display",
        detail: text(
          locale,
          `${name} can sit beside the bakery counter as a second point.`,
          `${name} pode ficar ao lado do balcão da padaria como ponto extra.`,
        ),
      });
    }
  }

  const planogram = facingN ? round2(facingSum / facingN) : 0;
  const priceReasons = stockouts.filter((row) => row.reason === "price").length;
  const priceVisibility = priceReasons ? 0.35 : counts.length ? 0.92 : 0;
  const expiryFlags = stockouts.filter((row) => row.reason === "expiry").length;
  const fefoCompliant = expiryFlags === 0;
  const executionScore = clamp(
    Math.round(planogram * 100 - stockouts.length * 10 - (fefoCompliant ? 0 : 8) - priceReasons * 6),
    0,
    100,
  );

  const storeName = input.storeName || "Store";
  const strengths = [];
  const weaknesses = defects.slice(0, 3).map((defect) => defect.detail);
  const threat = [];
  if (planogram >= 0.85) {
    strengths.push(text(locale, "Planogram facings are close to target.", "As frentes estão perto do planograma."));
  }
  if (!stockouts.length) {
    strengths.push(text(locale, "No stock-out was logged on this visit.", "Nenhuma ruptura foi registrada nesta visita."));
  }
  if (input.keyAccount) {
    strengths.push(text(locale, "Key account: the seller can negotiate space this week.", "Conta-chave: o vendedor pode negociar espaço nesta semana."));
  }
  if (!strengths.length) {
    strengths.push(text(locale, "The visit produced a counted shelf, not a guess.", "A visita gerou uma contagem de gôndola, não um palpite."));
  }
  if (defects.some((defect) => defect.type === "stockout")) {
    threat.push(text(locale, "An empty facing is an open invitation to a competitor.", "Frente vazia é convite para o concorrente."));
  }
  if (input.lot && input.lot.daysLeft != null && input.lot.daysLeft <= 10) {
    threat.push(text(
      locale,
      `A lot estimated from the invoice may expire in ${input.lot.daysLeft} days.`,
      `Um lote estimado pela nota pode vencer em ${input.lot.daysLeft} dias.`,
    ));
  }
  if (!threat.length) {
    threat.push(text(locale, "No immediate competitive loss was flagged.", "Nenhuma perda competitiva imediata foi marcada."));
  }

  const expiryRisks = input.lot && input.lot.daysLeft != null && input.lot.daysLeft <= 10
    ? [{
      sku: input.lot.sku,
      daysLeft: input.lot.daysLeft,
      action: text(locale, "Rotate that lot forward and tell the seller.", "Gire esse lote para a frente e avise o vendedor."),
    }]
    : [];

  return {
    source: "mock",
    model: "mock-rota-clara-v1",
    storeId: input.storeId || null,
    storeName,
    visitId: input.visitId || null,
    locale,
    executionScore,
    planogramCompliance: planogram,
    priceVisibility: round2(priceVisibility),
    fefo: {
      compliant: fefoCompliant,
      notes: fefoCompliant
        ? text(
          locale,
          "No short-dated unit was flagged. Expiry on the agenda is estimated from the invoice date plus shelf life.",
          "Nenhuma unidade com prazo curto foi marcada. A validade da agenda é estimada pela data da nota mais a vida de prateleira.",
        )
        : text(
          locale,
          "Short-dated or expired product is on display. Pull it and apply FEFO.",
          "Há produto vencido ou com prazo curto na exposição. Retire e aplique PEPS/FEFO.",
        ),
    },
    defects,
    opportunities,
    swot: {
      strengths,
      weaknesses: weaknesses.length
        ? weaknesses
        : [text(locale, "No material weakness on the counted shelf.", "Nenhuma fraqueza relevante na gôndola contada.")],
      opportunities: opportunities.length
        ? opportunities.map((item) => item.detail)
        : [text(locale, "Keep the current space and protect the price tag.", "Mantenha o espaço atual e proteja a etiqueta de preço.")],
      threats: threat,
    },
    expiryRisks,
    summary: text(
      locale,
      `${storeName}: execution ${executionScore}/100 from the shelf count${input.photoDataUrl ? " (photo attached for the vision model)" : ""}.`,
      `${storeName}: execução ${executionScore}/100 a partir da contagem${input.photoDataUrl ? " (foto anexada para o modelo de visão)" : ""}.`,
    ),
    notify: {
      to: input.recipients || [],
      subject: text(locale, `Shelf audit · ${storeName}`, `Auditoria de gôndola · ${storeName}`),
      preview: true,
    },
    photoReceived: Boolean(input.photoDataUrl),
  };
}

export function presentAudit(record, locale) {
  if (record?.source === "mock" && record.input) {
    const rebuilt = buildMockAudit({ ...record.input, locale, photoDataUrl: record.photoReceived ? "attached" : "" });
    return { ...rebuilt, id: record.id, servedBy: record.servedBy || "device", createdAt: record.createdAt };
  }
  return {
    ...record,
    defects: record?.defects || [],
    opportunities: record?.opportunities || [],
    swot: {
      strengths: asList(record?.swot?.strengths),
      weaknesses: asList(record?.swot?.weaknesses),
      opportunities: asList(record?.swot?.opportunities),
      threats: asList(record?.swot?.threats),
    },
    expiryRisks: record?.expiryRisks || [],
    fefo: record?.fefo || { compliant: true, notes: "" },
  };
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [String(value)];
}

export function emailBody(audit) {
  const lines = [
    audit.summary,
    "",
    `Execution: ${audit.executionScore}/100`,
    `Planogram: ${Math.round((audit.planogramCompliance || 0) * 100)}%`,
    `Price visibility: ${Math.round((audit.priceVisibility || 0) * 100)}%`,
    `FEFO: ${audit.fefo?.compliant ? "ok" : "attention"} — ${audit.fefo?.notes || ""}`,
    "",
    "Defects:",
    ...(audit.defects.length ? audit.defects.map((item) => `- ${item.detail || item.type}`) : ["- none"]),
    "",
    "Opportunities:",
    ...(audit.opportunities.length ? audit.opportunities.map((item) => `- ${item.detail || item.type}`) : ["- none"]),
    "",
    "This message is a preview. The demo does not send email.",
  ];
  return lines.join("\n");
}
