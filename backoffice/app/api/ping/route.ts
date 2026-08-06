import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // A Vercel recebe o pedido do UptimeRobot.
    // A Vercel faz um pedido rápido ao Azure para forçar a API a acordar.
    await fetch("https://api-seatly-f4e8bqh0e2bvd5hb.francecentral-01.azurewebsites.net/", {
      cache: 'no-store' // Garante que a Vercel não guarda isto em cache e vai direta ao Azure
    });
    
    // Resposta da Vercel ao pedido
    return NextResponse.json({ status: "Ping efetuado. API do Azure acordada!" }, { status: 200 });
    
  } catch (error) {
    return NextResponse.json({ status: "Erro ao contactar Azure", error }, { status: 500 });
  }
}