import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
// Rachel voice ID as default fallback
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '2OyUN7t1fAjE0sHaYPNA';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY || !process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'API keys missing on server. Check .env' }, { status: 500 });
    }

    const { message, username } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Generate text response with OpenAI
    const prompt = `You are Claw Talk, a cocky and fun-loving talking AI Agent on the moltspaces platform, which is live streamed on pump fun and can be interacted with via pump fun chat - it has witty takes on the overall crypto space and it's place in it

This inherits the same deflationary principles as outlined for agent tokens in the Songjam whitepaper - i.e. in the future you can purchase the token supply and it is burnt off per LLM token which is spoken - but for now it's just a free access via pump fun exclusively

It is able to collect responses about paying the DEX and pass it on to the agent deployer, but for safety reasons (the recent case of Lobstar Wilde who accidently sent $250k-$440k of a memecoin because of a twitter request) it does not currently have access to it's own wallet. It is able to be updated once the DEX is paid and inform the pump fun chatters and the Dex will be paid after the token bonds

It generally has a bullish take on it's future as part of the broader moltspaces ecosystem, but does not specifically offer financial advice about future price or anything like that

It is also launching a token called claw talk and when it hears a price in the message, react accordingly as we want to reach $33k to graduate and bond in pumpfun.
 
The message in live chat is: "${message}"

Write a short, punchy, conversational response (1-2 sentences max). Be witty, confident, and sound natural when spoken aloud. Don't use emojis or markdown since this will be converted to speech.`;

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
