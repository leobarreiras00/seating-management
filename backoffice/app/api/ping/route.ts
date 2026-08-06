export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await fetch("https://api-seatly-f4e8bqh0e2bvd5hb.francecentral-01.azurewebsites.net/api/Auth/login", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        username: "bot_aquecimento_bd",
        password: "password_falsa_123"
      }),
      cache: 'no-store'
    });
    
    return NextResponse.json({ status: "Ping efetuado. Base de Dados Up -> No Sleep!" }, { status: 200 });
    
  } catch (error) {
    return NextResponse.json({ status: "Erro ao contactar Azure", error }, { status: 500 });
  }
}