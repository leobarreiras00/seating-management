export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Pedido de fetch executado pela Vercel
    await fetch("https://api-seatly-f4e8bqh0e2bvd5hb.francecentral-01.azurewebsites.net/", {
      cache: 'no-store'
    });
    
    return NextResponse.json({ status: "Ping real efetuado. API do Azure acordada!" }, { status: 200 });
    
  } catch (error) {
    return NextResponse.json({ status: "Erro ao contactar Azure", error }, { status: 500 });
  }
}