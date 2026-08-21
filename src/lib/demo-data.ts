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

export const demoDateRows = (count: number, spread = 30) =>
  Array.from({ length: count }, (_, index) => ({
    created_at: new Date(now - (index % spread) * 86400000 - (index % 12) * 3600000).toISOString(),
  }));
