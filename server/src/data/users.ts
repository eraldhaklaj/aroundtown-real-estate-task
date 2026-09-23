import type { User } from "../types.js";

// Hard-coded demo accounts. Passwords are stored only as bcrypt hashes;
// the plaintext demo credentials are documented in the README.
export const users: User[] = [
  {
    id: "u-buyer-1",
    email: "buyer@demo.com",
    name: "Sam Becker",
    role: "user",
    passwordHash: "$2b$10$I4wiyNdK0GHxWyPTAGJGmue3uob4rLDBqdrf9GYR5S8dVPSCYYLcC", // Buyer123!
  },
  {
    id: "u-agent-1",
    email: "agent@demo.com",
    name: "Alex Wagner",
    role: "agent",
    passwordHash: "$2b$10$Ac01w1j4Te0B4kw9hZBu.uO0O1LpE17Tpkf41..ogDUckHOd.G2Pe", // Agent123!
  },
];

export function findUserByEmail(email: string) {
  return users.find((u) => u.email === email.toLowerCase());
}

export function findUserById(id: string) {
  return users.find((u) => u.id === id);
}
