import { z } from "zod";

export const dossierSchema = z.object({
  client_first_name: z.string().trim().max(100).optional().or(z.literal("")),
  client_last_name: z.string().trim().max(100).optional().or(z.literal("")),
  client_phone: z.string().trim().max(20)
    .regex(/^[\d\s\+\-\.()]*$/, "Numéro de téléphone invalide")
    .optional()
    .or(z.literal("")),
  client_email: z.string().trim().email("Email invalide").max(255).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  address_line: z.string().trim().max(300).optional().or(z.literal("")),
  postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  google_place_id: z.string().trim().max(300).optional().or(z.literal("")),
  lat: z.number().optional(),
  lng: z.number().optional(),
  category: z.enum(["wc", "fuite", "chauffe_eau", "evier", "douche", "autre"]),
  urgency: z.enum(["aujourdhui", "48h", "semaine"]),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
});

export type DossierFormData = z.infer<typeof dossierSchema>;

export const defaultDossierValues: DossierFormData = {
  client_first_name: "",
  client_last_name: "",
  client_phone: "",
  client_email: "",
  address: "",
  address_line: "",
  postal_code: "",
  city: "",
  country: "",
  google_place_id: "",
  category: "autre",
  urgency: "semaine",
  description: "",
};
