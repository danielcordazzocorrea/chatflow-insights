const now = Date.now();
const ago = (hours: number) => new Date(now - hours * 60 * 60 * 1000).toISOString();

export const demoClientes = [
  {
    id: "demo-1",
    bsuid: "demo-1",
    nome: "Marina Costa",
    telefone: "(11) 90000-1001",
    responded: "true",
    ia_ativa: true,
    created_at: ago(2),
  },
  {
    id: "demo-2",
    bsuid: "demo-2",
    nome: "Lucas Almeida",
    telefone: "(21) 90000-1002",
    responded: "false",
    ia_ativa: false,
    created_at: ago(8),
  },
  {
    id: "demo-3",
    bsuid: "demo-3",
    nome: "Fernanda Lima",
    telefone: "(31) 90000-1003",
    responded: "true",
    ia_ativa: true,
    created_at: ago(30),
  },
];

export const demoMessages = [
  {
    id: "demo-m1",
    message_id: "demo-m1",
    message_text: "Olá, gostaria de saber mais.",
    message_status: "read",
    who_sent: "client",
    telefone: "(11) 90000-1001",
    created_at: ago(2),
  },
  {
    id: "demo-m2",
    message_id: "demo-m2",
    message_text: "Claro! Como posso ajudar?",
    message_status: "delivered",
    who_sent: "manual_response",
    telefone: "(11) 90000-1001",
    created_at: ago(1.8),
  },
  {
    id: "demo-m3",
    message_id: "demo-m3",
    message_text: "Quais são os planos disponíveis?",
    message_status: "read",
    who_sent: "client",
    telefone: "(11) 90000-1001",
    created_at: ago(1.5),
  },
  {
    id: "demo-m4",
    message_id: "demo-m4",
    message_text: "Obrigado pelo atendimento!",
    message_status: "read",
    who_sent: "client",
    telefone: "(31) 90000-1003",
    created_at: ago(30),
  },
];

export const demoDateRows = (count: number, spread = 30) => {
  const days = Math.max(1, Math.floor(spread));
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);

  // Perfil determinístico com tendência, sazonalidade semanal e picos ocasionais.
  const weights = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.58 : 1;
    const trend = 0.78 + (index / Math.max(days - 1, 1)) * 0.42;
    const wave = 1 + Math.sin(index * 1.37 + count * 0.013) * 0.2;
    const variation = 0.82 + ((index * 17 + count * 7) % 13) / 25;
    const peak = index === days - 8 || index === days - 3 ? 1.38 : 1;
    return weekendFactor * trend * wave * variation * peak;
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const exactCounts = weights.map((weight) => (weight / totalWeight) * count);
  const dailyCounts = exactCounts.map(Math.floor);
  let remaining = count - dailyCounts.reduce((sum, value) => sum + value, 0);

  exactCounts
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction)
    .forEach(({ index }) => {
      if (remaining > 0) {
        dailyCounts[index] += 1;
        remaining -= 1;
      }
    });

  return dailyCounts.flatMap((dailyCount, dayIndex) =>
    Array.from({ length: dailyCount }, (_, itemIndex) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (days - 1 - dayIndex));
      date.setHours(8 + ((itemIndex * 3 + dayIndex) % 12), (itemIndex * 11) % 60, 0, 0);
      return { created_at: date.toISOString() };
    }),
  );
};
