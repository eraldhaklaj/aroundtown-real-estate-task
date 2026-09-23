// Private, agent-only data. Kept out of the Listing objects on purpose, so it can never end up
// in the public API or the model's context. Only the listing's own agent sees it.
export interface PrivateListingData {
  sellerName: string;
  sellerPhone: string;
  minimumPrice?: number;
  agentNotes: string;
}

export const privateListingData: Record<string, PrivateListingData> = {
  "lst-001": {
    sellerName: "Dr. Heike Brandt",
    sellerPhone: "+49 170 555 0142",
    minimumPrice: 705000,
    agentNotes: "Seller relocating to Munich, wants to close before February. Will consider offers from 705k.",
  },
  "lst-002": {
    sellerName: "Familie Okonkwo",
    sellerPhone: "+49 151 555 0199",
    minimumPrice: 1120000,
    agentNotes: "Two offers expected after the open house. Parking space negotiable separately.",
  },
  "lst-005": {
    sellerName: "Estate of M. Lindqvist",
    sellerPhone: "+49 30 555 0177",
    minimumPrice: 1290000,
    agentNotes: "Probate complete. Heirs prefer a quick cash buyer.",
  },
};
