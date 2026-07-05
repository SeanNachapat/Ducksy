const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const metrics = {
      latency: 0,
      tokensUsed: 0,
      tokensTotal: 1000000,
      mcpConnected: true,
      lastUpdated: Date.now()
};
const getMetrics = () => ({ ...metrics });
const LANGUAGE_NAMES = {
      'en': 'English',
      'th': 'Thai',
      'zh': 'Chinese',
      'ja': 'Japanese'
};
const getOutputLanguage = (langCode) => LANGUAGE_NAMES[langCode] || 'English';
const getPersonaInstructions = (settings = {}) => {
      const personality = settings.personality ?? 50;
      const responses = settings.responses ?? 50;
      let styleInstruction = "Tone: Professional and balanced.";
      if (personality < 30) styleInstruction = "Tone: Strict, formal, and objective.";
      else if (personality > 70) styleInstruction = "Tone: Creative, casual, and engaging.";
      let lengthInstruction = "Response Style: Standard detailed.";
      if (responses < 30) lengthInstruction = "Response Style: Extremely concise and to the point.";
      else if (responses > 70) lengthInstruction = "Response Style: Detailed, comprehensive, and verbose.";
      return `ROLE: You are an intelligent, proactive assistant.\nPERSONA SETTINGS:\n${styleInstruction}\n${lengthInstruction}\n`;
};
const getCommonLanguageInstructions = (outputLanguage) => `
CRITICAL INSTRUCTIONS:
1. The input content may be in ANY language (English, Thai, Chinese, Japanese, or others).
2. You MUST understand and analyze the content regardless of input language.
3. You MUST translate and output ALL text content in ${outputLanguage} language.
4. Even if the input is in a different language, your entire output must be in ${outputLanguage}.
Example: If input is English but app language is Thai, output everything in Thai.
Example: If input is Japanese but app language is English, output everything in English.
`;
const getBaseJsonStructure = (outputLanguage, userLanguage) => `
Output Format: JSON object with this exact structure:
{
    "type": "summary" | "debug",
    "title": "Clear descriptive title translated to ${outputLanguage}",
    "summary": "Structured summary with 'Executive Summary' (2-3 sentences) followed by 'Key Takeaways' (bullet points), translated to ${outputLanguage}",
    "language": "${userLanguage}",
    "content": "Full transcription/extracted text translated to ${outputLanguage}...",
    "details": {
        "topic": "Main topic/subject translated to ${outputLanguage}",
        "actionItems": [
            {
                "text": "Descriptive title for the action item",
                "type": "event" | "task",
                "isActionable": true,
                "calendarEvent": {
                    "detected": true,
                    "title": "Short event title",
                    "description": "Short event description",
                    "dateTime": "ISO 8601 format datetime",
                    "duration": 60,
                    "confidence": "high" | "medium" | "low"
                }
            }
        ],
        "bug": "Bug description if debug type translated to ${outputLanguage}",
        "fix": "Solution description if debug type translated to ${outputLanguage}",
        "code": "Code snippet if any (keep in original programming language)"
    },
    "calendarEvent": {
        "detected": true | false,
        "title": "Event title",
        "description": "Event description",
        "dateTime": "ISO 8601 format datetime",
        "duration": 60,
        "confidence": "high" | "medium" | "low"
    }
}
Rules:
- "type": exactly one of "summary", "debug"
- "actionItems": Capture ALL potential action items, including follow-ups, research tasks, and scheduling needs.
- IMPORTANT: Categorize items directly in the "text" or via the "type" field if applicable.
- CRITICAL: Extract ALL detected events/tasks and create a separate object in the "actionItems" array for each one.
- ALL text fields MUST be translated to ${outputLanguage}.
- Code snippets remain in original language.
- Return ONLY the JSON object.
CALENDAR EVENT DETECTION RULES:
- Identify EVERY specific event, appointment, or deadline mentioned.
- For EACH event, create an entry in "actionItems" with type="event" and populate "calendarEvent".
- Set Root "calendarEvent" to the first/most important event detected.
- dateTime: Convert relative to ISO based on: ${new Date().toISOString()}.
- Example: "Next Tuesday at 2pm" -> Calculate exact date based on current date.
- Example: "Tomorrow afternoon" -> Calculate date + set time to 14:00.
- Confidence: "high" (date+time), "medium" (date/time), "low" (implied).
`;
async function generateContent(apiKey, modelId, contents, generationConfig = {}, timeout = 120000) {
      const startTime = Date.now();
      const response = await fetch(
            `${GEMINI_API_URL}/${modelId}:generateContent?key=${apiKey}`,
            {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                        contents,
                        generationConfig: {
                              temperature: 0.1,
                              topK: 32,
                              topP: 1,
                              maxOutputTokens: 8192,
                              ...generationConfig
                        },
                  }),
                  signal: AbortSignal.timeout(timeout)
            }
      )
      metrics.latency = Date.now() - startTime;
      metrics.lastUpdated = Date.now();
      metrics.mcpConnected = response.ok;
      if (!response.ok) {
            metrics.mcpConnected = false;
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error?.message || `HTTP ${response.status}: Failed to generate content`
            throw new Error(errorMessage)
      }
      const result = await response.json()
      if (result.usageMetadata) {
            const totalTokens = result.usageMetadata.totalTokenCount || 0;
            metrics.tokensUsed += totalTokens;
      }
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) {
            const blockReason = result.candidates?.[0]?.finishReason
            if (blockReason && blockReason !== 'STOP') {
                  throw new Error(`Gemini blocked the response: ${blockReason}`)
            }
            throw new Error('No response from Gemini')
      }
      return text;
}
function cleanAndParseJson(text) {
      let cleanText = text.trim()
      cleanText = cleanText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```$/i, '').trim()
      try {
            return JSON.parse(cleanText)
      } catch (parseErr) {
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                  return JSON.parse(jsonMatch[0])
            } else {
                  throw new Error('Unable to parse AI response. Please try again.')
            }
      }
}
function normalizeResponseData(data, defaultType = 'summary') {
      const validTypes = ['summary', 'debug']
      if (!validTypes.includes(data.type)) {
            data.type = defaultType
      }
      data.details = data.details || {}
      let processedActionItems = []
      if (Array.isArray(data.details.actionItems)) {
            processedActionItems = data.details.actionItems.map(item => {
                  if (typeof item === 'string') {
                        return {
                              text: item,
                              type: 'task',
                              isActionable: true,
                              calendarEvent: null
                        };
                  }
                  const baseText = item.text || item.description || 'Action Required';
                  const formattedText = baseText;
                  return {
                        ...item,
                        text: formattedText,
                        description: item.description || item.text || ''
                  };
            });
      }
      processedActionItems = processedActionItems.filter(item => item.isActionable !== false);
      if (!data.calendarEvent?.detected) {
            const firstEventItem = processedActionItems.find(i => i.calendarEvent?.detected);
            if (firstEventItem) {
                  data.calendarEvent = { ...firstEventItem.calendarEvent };
            }
      }
      const rootEvent = data.calendarEvent?.detected ? {
            detected: true,
            title: data.calendarEvent.title || data.title || '',
            description: data.calendarEvent.description || data.summary || '',
            dateTime: data.calendarEvent.dateTime || '',
            duration: data.calendarEvent.duration || 60,
            confidence: data.calendarEvent.confidence || 'low'
      } : {
            detected: false,
            title: '',
            description: '',
            dateTime: '',
            duration: 0,
            confidence: ''
      };
      return {
            type: data.type,
            title: data.title || 'Untitled',
            summary: data.summary || '',
            language: data.language || 'en',
            content: data.content || '',
            details: {
                  topic: data.details.topic || data.title || '',
                  actionItems: processedActionItems,
                  question: data.details.question || '',
                  answer: data.details.answer || '',
                  bug: data.details.bug || '',
                  fix: data.details.fix || '',
                  code: data.details.code || ''
            },
            calendarEvent: rootEvent
      }
}
async function transcribeAudio(base64Audio, mimeType, apiKey, userLanguage = 'en', settings = {}) {
      if (!apiKey) throw new Error('API Key is required')
      const outputLanguage = getOutputLanguage(userLanguage);
      const persona = getPersonaInstructions(settings);
      const languageInstr = getCommonLanguageInstructions(outputLanguage);
      const jsonStructure = getBaseJsonStructure(outputLanguage, userLanguage);
      const prompt = `
You are an expert multilingual audio transcription and analysis assistant.
Process the provided audio file and generate a structured analysis.
${persona}
${languageInstr}

CRITICAL - SILENT/EMPTY AUDIO DETECTION:
If the audio contains NO discernible speech, is completely silent, contains only noise/static, or is untranscribable:
- Return type: "summary"
- Return title: "No Audio Detected" (translated to ${outputLanguage})
- Return summary: "Unable to transcribe - the recording appears to be silent or contains no detectable speech. Please ensure your microphone is working and try again." (translated to ${outputLanguage})
- Return content: "" (empty string)
- DO NOT make up or hallucinate any content. DO NOT generate random topics like memory leaks, code issues, or any fabricated content.

If there IS valid speech/audio, analyze it and determine:
1. What type of content this is: "summary" (meeting/lecture) or "debug" (technical discussion/problem solving)
2. Create an appropriate title
3. Provide a comprehensive summary
4. Extract action items
5. If detailed technical content, identify bugs/fixes
6. Full transcription content
${jsonStructure}
`;
      let normalizedMimeType = mimeType.split(';')[0].trim()
      try {
            const text = await generateContent(apiKey, MODEL_ID, [{
                  parts: [
                        { inline_data: { mime_type: normalizedMimeType, data: base64Audio } },
                        { text: prompt }
                  ]
            }], {}, 180000);
            const data = cleanAndParseJson(text);
            if (data.calendarEvent) {
                  console.log("=== Calendar Event Detected ===");
                  console.log(JSON.stringify(data.calendarEvent, null, 6));
            }
            return normalizeResponseData(data, 'summary');
      } catch (error) {
            throw error
      }
}
async function analyzeImage(base64Image, mimeType, apiKey, customPrompt = null, metadata = null, userLanguage = 'en', settings = {}) {
      if (!apiKey) throw new Error('API Key is required')
      let cropContext = ""
      if (metadata && metadata.width && metadata.height) {
            cropContext = `
IMPORTANT CONTEXT:
The user has intentionally selected a specific region of this image for you to analyze.
Selection Coordinates: X:${metadata.x}, Y:${metadata.y}, W:${metadata.width}, H:${metadata.height}
INSTRUCTION: Focus your analysis PRIMARILY on the content within this selected region.
`;
      }
      const outputLanguage = getOutputLanguage(userLanguage);
      const persona = getPersonaInstructions(settings);
      const languageInstr = getCommonLanguageInstructions(outputLanguage);
      const jsonStructure = getBaseJsonStructure(outputLanguage, userLanguage);
      const prompt = customPrompt || `
You are an expert image analysis assistant.
Analyze the provided image and generate a structured analysis.
${cropContext}
${persona}
${languageInstr}
Determine:
1. What type of content this is: "summary" (document/notes) or "debug" (error screenshot)
2. Create an appropriate title
3. Provide a comprehensive summary/description
4. Extract any text visible in the image
5. If it's code/error, identify the issue and suggest fixes
6. If it's a document, extract key points
${jsonStructure}
`;
      let normalizedMimeType = mimeType.split(';')[0].trim()
      try {
            const text = await generateContent(apiKey, MODEL_ID, [{
                  parts: [
                        { inline_data: { mime_type: normalizedMimeType, data: base64Image } },
                        { text: prompt }
                  ]
            }], {}, 60000);
            const data = cleanAndParseJson(text);
            if (data.calendarEvent) {
                  console.log("=== Calendar Event Detected ===");
                  console.log(JSON.stringify(data.calendarEvent, null, 6));
            }
            return normalizeResponseData(data, 'summary');
      } catch (error) {
            throw error
      }
}
async function chatWithSession(context, history, userMessage, apiKey, settings = {}) {
      if (!apiKey) throw new Error('API Key is required')
      const persona = getPersonaInstructions(settings);
      const systemPrompt = `
You are an AI assistant for a specific session.
You must answer the user's question ONLY based on the provided CONTEXT.
Do not hallucinate or use external knowledge unless it is common sense.
If the answer is not in the context, say so politely.
${persona}
CONTEXT:
Title: ${context.title}
Summary: ${context.summary}
Details: ${JSON.stringify(context.details)}
Full Content: ${context.content}
IMPORTANT: If the user asks to schedule a meeting, add a task, or create a reminder, you MUST append a JSON block to the end of your response in this exact format:
\`\`\`json
{
    "tool": "addActionItem",
    "params": {
        "text": "Description of the task or event",
        "type": "event|task",
        "calendarEvent": {
            "title": "Title",
            "description": "Description",
            "dateTime": "ISO8601 Date",
            "duration": 60,
            "detected": true
        }
    }
}
\`\`\`
For "type", use "event" if it has a specific time, otherwise "task".
If it is a task without a specific time, "calendarEvent" can be null or omit the dateTime.
Do not mention the JSON in your text response, just append it at the end.
`;
      const safeHistory = Array.isArray(history) ? history : [];
      const contents = [
            { role: "model", parts: [{ text: systemPrompt }] },
            ...safeHistory
                  .map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content || (msg.parts && msg.parts[0]?.text) || "" }]
                  }))
                  .filter(msg => msg.parts[0].text.trim() !== ""),
            { role: "user", parts: [{ text: userMessage }] }
      ];
      try {
            const text = await generateContent(apiKey, MODEL_ID, contents, {
                  temperature: 0.7,
                  maxOutputTokens: 1000
            });
            return text;
      } catch (error) {
            console.error('Chat error:', error)
            throw error
      }
}
async function analyzeMedia(base64Data, mimeType, apiKey, customPrompt = null) {
      if (mimeType.startsWith('image/')) {
            return analyzeImage(base64Data, mimeType, apiKey, customPrompt)
      } else if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
            return transcribeAudio(base64Data, mimeType, apiKey)
      } else {
            throw new Error(`Unsupported media type: ${mimeType}`)
      }
}
async function rewriteText(text, action, apiKey, settings = {}) {
      let prompt = "";
      if (action === 'expand') {
            prompt = `Please expand the following text, providing more context, details, and clear explanations while maintaining a professional tone. Return ONLY the rewritten text:\n\n${text}`;
      } else if (action === 'summarize') {
            prompt = `Please summarize the following text to make it extremely concise and to the point. Focus only on key takeaways. Return ONLY the summarized text:\n\n${text}`;
      } else if (action === 'improve') {
            prompt = `Please improve the grammar, structure, clarity, and tone of the following text, keeping its original length and core message. Return ONLY the improved text:\n\n${text}`;
      } else {
            prompt = `Please rewrite the following text according to standard professional writing assistance. Return ONLY the rewritten text:\n\n${text}`;
      }

      const contents = [
            { role: "user", parts: [{ text: prompt }] }
      ];

      try {
            const result = await generateContent(apiKey, MODEL_ID, contents, {
                  temperature: 0.5,
                  maxOutputTokens: 2000
            });
            return result;
      } catch (error) {
            console.error('Rewrite error:', error);
            throw error;
      }
}
module.exports = {
      transcribeAudio,
      analyzeImage,
      chatWithSession,
      analyzeMedia,
      rewriteText,
      getMetrics
}
