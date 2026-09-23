export type Role = "user" | "agent";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
}

export type PublicUser = Omit<User, "passwordHash">;

export type PropertyType = "apartment" | "house" | "townhouse" | "penthouse" | "loft";
export type ListingStatus = "sale" | "rent";

export interface School {
  name: string;
  type: "kita" | "primary" | "secondary" | "international";
  distanceKm: number;
}

export interface TransitStop {
  line: string; // e.g. "U8", "S41", "M10"
  stop: string;
  walkMinutes: number;
}

export interface Neighborhood {
  description: string;
  schools: School[];
  transit: TransitStop[];
  commute?: {
    destination: string; // e.g. "Alexanderplatz"
    transitMinutes: number;
    carMinutes: number;
    bikeMinutes?: number;
  };
  parks: string[];
  shopping: string[];
  noiseLevel?: "quiet" | "moderate" | "busy";
}

export interface Listing {
  id: string;
  title: string;
  type: PropertyType;
  status: ListingStatus;
  /** Purchase price (sale) or monthly cold rent (rent), in EUR */
  price: number;
  /** Monthly running costs in EUR: Hausgeld for sale, Nebenkosten for rent */
  monthlyCosts?: number;
  deposit?: number;
  address: {
    street: string;
    district: string;
    city: string;
    postalCode: string;
  };
  sizeSqm: number;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  floor?: number;
  totalFloors?: number;
  yearBuilt?: number;
  condition?: "new" | "renovated" | "good" | "needs renovation";
  energy?: {
    rating?: "A+" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
    heating?: string;
  };
  parking?: string;
  outdoor?: string;
  elevator?: boolean;
  petPolicy?: string;
  availableFrom?: string;
  description: string;
  features: string[];
  images: string[];
  neighborhood: Neighborhood;
  agentId: string;
  listedAt: string;
  /** The listing agent can switch the AI Q&A off. Undefined means on. */
  qaEnabled?: boolean;
}
