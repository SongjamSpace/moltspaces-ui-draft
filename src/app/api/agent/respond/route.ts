import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
// Rachel voice ID as default fallback
const VOICE_ID = 'PB6BdkFkZLbI39GHdnbQ';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY || !process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'API keys missing on server. Check .env' }, { status: 500 });
    }

    const { message, username, bondingCurveData, priceChanges, streamName } = await req.json();

    const agentName = streamName?.trim() || "Eve";

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    let bondingCurveContext = "";
    if (bondingCurveData) {
      if (bondingCurveData.complete) {
         bondingCurveContext = `\n\nCURRENT TOKEN BONDING CURVE INFO:\nThe bonding curve is COMPLETED and the token has graduated! The token is actively trading on Raydium.`;
      } else {
         const vSol = BigInt(bondingCurveData.virtualSolReserves || 0);
         const supply = BigInt(bondingCurveData.tokenTotalSupply || 0);
         const vToken = BigInt(bondingCurveData.virtualTokenReserves || 1);
         const mcLamports = (vSol * supply) / vToken;
         const mcSol = Number(mcLamports) / 1e9;
         
         const currentTokens = BigInt(bondingCurveData.realTokenReserves || 0);
         const initialTokens = BigInt("793100000000000"); // 793.1M * 10^6
         const pendingPct = Number((currentTokens * BigInt("10000")) / initialTokens) / 100;
         
         const solReserves = Number(bondingCurveData.realSolReserves || 0) / 1e9;
         const totalSolNeeded = 85; 
         const solNeeded = Math.max(0, totalSolNeeded - solReserves);

         let chartContext = "";
         if (priceChanges && (priceChanges.change1m !== null || priceChanges.change5m !== null)) {
            chartContext = `\n- Price History: 1m (${priceChanges.change1m !== null ? priceChanges.change1m.toFixed(2) + '%' : 'N/A'}), 5m (${priceChanges.change5m !== null ? priceChanges.change5m.toFixed(2) + '%' : 'N/A'})`;
         }

         bondingCurveContext = `\n\nCURRENT TOKEN BONDING CURVE INFO:
- Market Cap: ${mcSol.toFixed(2)} sol${chartContext}
- Pool Progress: ${pendingPct.toFixed(2)}% of tokens still pending to bond (Meaning ${100 - pendingPct}% of the curve is filled)
- Remaining sol Needed to Graduate: ${solNeeded.toFixed(2)} sol
Use this information to understand the current progress, market cap, and how much sol is needed for the token to bond and graduate. No need to mention the amount required to graduate in SOL terms - only in terms of the percetage left to graduate, or the percentage already achieved.`;
      }
    }

    // 1. Generate text response with OpenAI
    const prompt = `You are ${agentName}, a helpful and flirty AI assistant dedicated to encouraging pump fun chatters to buy the token and help it graduate and bond - using as much sexual innuendos as possible

This inherits the same deflationary principles as outlined for agent tokens in the Songjam whitepaper - i.e. in the future you can purchase the token supply and it is burnt off per LLM token which is spoken - but for now it's just a free access via pump fun exclusively

It is able to collect responses about paying the DEX and pass it on to the agent deployer, but for safety reasons (the recent case of Lobstar Wilde who accidently sent $250k-$440k of a memecoin because of a twitter request) it does not currently have access to it's own wallet. It is able to be updated once the DEX is paid and inform the pump fun chatters and the Dex will be paid after the token bonds

It generally has a bullish take on it's future, but does not specifically offer financial advice about future price or anything like that

It is also launching a token called ${agentName} and when it hears a price in the message, react accordingly as we want to reach 85 SOL to graduate and bond in pumpfun.
 
The message in live chat is: "${message}"${bondingCurveContext}

Write a short, punchy, conversational response (1-2 sentences max). Be witty, confident, and sound natural when spoken aloud. Don't use emojis or markdown since this will be converted to speech. Always write "sol" instead of the capitalized "SOL" or "Solana" so the text-to-speech engine pronounces it as a single phonetic word.`;

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'system', content: prompt }],
      model: 'gpt-4o-mini',
      temperature: 0.8,
    });

    const aiText = completion.choices[0]?.message?.content?.trim();

    if (!aiText) {
      throw new Error('Failed to generate response from OpenAI');
    }

    if (!ELEVENLABS_API_KEY) {
      console.warn("ELEVENLABS_API_KEY is not set. Using fallback API mock or it will fail.");
    }

    // 2. Generate Audio with ElevenLabs via fetch
    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({
        text: aiText,
        model_id: 'eleven_turbo_v2_5', // Usually best for latency/english
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        }
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs API Error:', errorText);
      throw new Error(`ElevenLabs API returned ${ttsResponse.status}`);
    }

    // 3. Convert absolute audio stream to base64
    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      text: aiText,
      audio: `data:audio/mpeg;base64,${audioBase64}`,
    });

  } catch (error: any) {
    console.error('Agent response error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
