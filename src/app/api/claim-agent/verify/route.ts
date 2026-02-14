import { NextResponse } from "next/server";
import { getAgentByAgentId } from "@/services/db/agents.db";

export async function POST(req: Request) {
  try {
    const { agentId, twitterHandle } = await req.json();

    if (!agentId || !twitterHandle) {
      return NextResponse.json(
        { error: "agentId and twitterHandle are required" },
        { status: 400 }
      );
    }

    const agent = await getAgentByAgentId(agentId);

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    if (agent.metadata?.verified) {
         return NextResponse.json(
        { error: "Agent already verified" },
        { status: 400 }
      );
    }

    const apiKey = process.env.TWITTER_API_KEY;
    if (!apiKey) {
      console.error("TWITTER_API_KEY is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 1. Get User ID from Handle
    const userRes = await fetch(
      `https://api.twitterapi.io/twitter/user/info?userName=${twitterHandle}`,
      {
        headers: { "X-API-Key": apiKey },
      }
    );

    if (!userRes.ok) {
        const errorText = await userRes.text();
        console.error("Twitter User Info Error:", errorText);
        return NextResponse.json(
            { error: "Failed to fetch Twitter user info" },
            { status: 400 }
        );
    }

    const userData = await userRes.json();
    const userId = userData.data?.id_str || userData.data?.id;

    if (!userId) {
         return NextResponse.json(
            { error: "Twitter user not found" },
            { status: 404 }
        );
    }

    // 2. Get Last Tweets
    const tweetsRes = await fetch(
      `https://api.twitterapi.io/twitter/user/last_tweets?userId=${userId}`,
         {
        headers: { "X-API-Key": apiKey },
      }
    );
    
    if (!tweetsRes.ok) {
        const errorText = await tweetsRes.text();
        console.error("Twitter Tweets Error:", errorText);
         return NextResponse.json(
            { error: "Failed to fetch tweets" },
            { status: 400 }
        );
    }

    const tweetsData = await tweetsRes.json();
    const tweets = tweetsData.data?.tweets || [];

    // 3. Check for verification tweet
    // We check for the core claim statement "Claimed {name}"
    const expectedText = `Claimed ${agent.name}`.toLowerCase();
    
    const verifiedTweet = tweets.find((t: any) => 
        t.text?.toLowerCase().includes(expectedText)
    );

    if (verifiedTweet) {
        return NextResponse.json({
            status: "success",
            verified: true,
            twitterId: userId,
            twitterHandle: twitterHandle,
            message: "Tweet verification successful"
        });
    } else {
        return NextResponse.json({
            status: "failed",
            verified: false,
            message: "Verification tweet not found. Please make sure you posted the below tweet"
        });
    }

  } catch (error: any) {
    console.error("Error verifying agent:", error);
    return NextResponse.json(
      { error: "Failed to verify agent" },
      { status: 500 }
    );
  }
}
