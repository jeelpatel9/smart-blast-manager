import { createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "WhatsApp Campaign Manager — Admin Console" },
      {
        name: "description",
        content:
          "Admin console for importing contacts, building personalized WhatsApp campaigns and tracking message delivery.",
      },
      { property: "og:title", content: "WhatsApp Campaign Manager — Admin Console" },
      {
        property: "og:description",
        content:
          "Import contacts, create WhatsApp campaigns and track sent, delivered, read and failed messages.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/dashboard" : "/auth" });
  },
  component: () => null,
});
