
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Você precisa estar conectado." },
        { status: 401 }
      );
    }

    const token = authorization.slice(7);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json(
        { error: "Configuração do Supabase incompleta." },
        { status: 500 }
      );
    }

    const userClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await userClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Sessão inválida. Entre novamente." },
        { status: 401 }
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, team_id, role")
      .eq("id", authData.user.id)
      .single();

    if (
      profileError ||
      !profile?.team_id ||
      profile.role !== "owner"
    ) {
      return NextResponse.json(
        { error: "Apenas o proprietário pode acessar os jogadores." },
        { status: 403 }
      );
    }

    const { data: players, error: playersError } = await admin
      .from("profiles")
      .select("id, display_name, role, created_at")
      .eq("team_id", profile.team_id)
      .order("display_name", { ascending: true });

    if (playersError) {
      return NextResponse.json(
        { error: "Não foi possível carregar os jogadores." },
        { status: 500 }
      );
    }

    return NextResponse.json({ players: players ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Erro inesperado ao carregar os jogadores." },
      { status: 500 }
    );
  }
}
