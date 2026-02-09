
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const apiKey = process.env.DAILY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Daily API key is not configured' },
      { status: 500 }
    );
  }

  try {
    const { roomName, username } = await request.json();

    if (!roomName) {
      return NextResponse.json(
        { error: 'Room Name is required' },
        { status: 400 }
      );
    }

    // Prepare token options for a listener
    // See: https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token
    const tokenOptions: any = {
      properties: {
        user_name: username || 'Listener',
        is_owner: false,
        start_audio_off: true,
        start_video_off: true,
      },
    };

    const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(tokenOptions),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create Daily token:', errorText);
      throw new Error(`Failed to create token: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Error generating Daily token:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
