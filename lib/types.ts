export type Participant = {
  id: string;
  name: string;
  unit: string;
  code: string;
  deliveredAt: string | null;
  createdAt: string;
};

export type DeliveryResult = {
  participant: Participant;
  already: boolean;
};
