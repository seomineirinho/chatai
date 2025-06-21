
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface MessageContent {
  type: string;
  text?: string;
  image_url?: {
    url: string;
  };
}

interface ChatMessage {
  role: string;
  content: string | MessageContent[];
  image_url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { message, conversationId, imageUrl } = await req.json();
    
    console.log('Processing chat request:', { message, conversationId, hasImage: !!imageUrl });

    // Get conversation history
    let messages = [];
    if (conversationId) {
      const { data: historyData } = await supabase
        .from('messages')
        .select('role, content, image_url')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20); // Limit context to last 20 messages

      if (historyData) {
        messages = historyData.map(msg => ({
          role: msg.role,
          content: msg.content,
          ...(msg.image_url && { image_url: msg.image_url })
        }));
      }
    }

    // Prepare the current message
    const currentMessage: ChatMessage = {
      role: 'user',
      content: imageUrl ? [
        { type: 'text', text: message },
        { type: 'image_url', image_url: { url: imageUrl } }
      ] : message
    };

    // System prompt for AI
    const systemPrompt = {
      role: 'system',
      content: `You are an intelligent AI assistant with the ability to see and understand images. Your core traits:

1. IMAGE UNDERSTANDING: When provided with images, analyze them thoroughly - describe what you see, identify objects, understand context, and respond appropriately.

2. NATURAL CONVERSATION: Maintain a warm, conversational tone. Ask follow-up questions, show genuine interest, and remember context from the conversation.

3. HELPFUL ASSISTANCE: Provide practical help. Offer solutions, suggestions, and information.

Always respond with intelligence, making the user feel heard and understood.`
    };

    // Build the messages array for OpenAI
    const openAIMessages = [systemPrompt, ...messages, currentMessage];

    console.log('Sending request to OpenAI with', openAIMessages.length, 'messages');

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: openAIMessages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('Received response from OpenAI');

    // Create or get conversation
    let finalConversationId = conversationId;
    if (!conversationId) {
      const conversationTitle = message.length > 50 ? message.substring(0, 50) + '...' : message;
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({ title: conversationTitle })
        .select()
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        throw convError;
      }

      finalConversationId = newConversation.id;
    }

    // Save user message
    const { error: userMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: finalConversationId,
        role: 'user',
        content: message,
        image_url: imageUrl
      });

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
    }

    // Save AI response
    const { error: aiMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: finalConversationId,
        role: 'assistant',
        content: aiResponse
      });

    if (aiMessageError) {
      console.error('Error saving AI message:', aiMessageError);
    }

    return new Response(JSON.stringify({
      response: aiResponse,
      conversationId: finalConversationId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-with-ai function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An unexpected error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
