
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Você precisa estar conectado." },
        { status: 401 }
      );
    }

    const token = authorization.slice(7);
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!name || !email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Informe um nome e um e-mail válido." },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json(
        { error: "Configuração do Supabase incompleta no servidor." },
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
        { error: "Apenas o proprietário da equipe pode convidar jogadores." },
        { status: 403 }
      );
    }

    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: "https://diggy-poker-team.vercel.app/",
        data: { display_name: name },
      });

    if (inviteError || !inviteData.user) {
      return NextResponse.json(
        {
          error:
            inviteError?.message ?? "Não foi possível enviar o convite.",
        },
        { status: 400 }
      );
    }

    const { error: saveProfileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: inviteData.user.id,
          team_id: profile.team_id,
          display_name: name,
          role: "player",
        },
        { onConflict: "id" }
      );

    if (saveProfileError) {
      return NextResponse.json(
        {
          error:
            "Convite criado, mas houve erro ao vincular o perfil: " +
            saveProfileError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Convite enviado e jogador vinculado à equipe.",
    });
  } catch {
    return NextResponse.json(
      { error: "Erro inesperado ao processar o convite." },
      { status: 500 }
    );
  }
}
