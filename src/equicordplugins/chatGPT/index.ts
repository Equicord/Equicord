import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import {
  ApplicationCommandInputType,
  ApplicationCommandOptionType,
  sendBotMessage,
} from "@api/Commands";

const settings = definePluginSettings({
  apiKey: {
    type: OptionType.STRING,
    description:
      "Your OpenAI API key (obtained from https://platform.openai.com/api-keys)",
    default: "",
    placeholder: "sk-proj-...",
  },
  model: {
    type: OptionType.SELECT,
    description: "ChatGPT model to use",
    default: "gpt-4o-mini",
    options: [
      {
        label: "GPT-4o (2024-08-06) - Recommended",
        value: "gpt-4o-2024-08-06",
      },
      {
        label: "GPT-4o Mini (2024-07-18) - Fast & Economical",
        value: "gpt-4o-mini-2024-07-18",
      },
      { label: "GPT-4o Mini", value: "gpt-4o-mini" },
      { label: "GPT-4o", value: "gpt-4o" },
      { label: "GPT-4 Turbo (2024-04-09)", value: "gpt-4-turbo-2024-04-09" },
      { label: "GPT-4 Turbo", value: "gpt-4-turbo-preview" },
      { label: "GPT-4 (0613)", value: "gpt-4-0613" },
      { label: "GPT-4", value: "gpt-4" },
      { label: "GPT-3.5 Turbo (0125)", value: "gpt-3.5-turbo-0125" },
      { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
    ],
  },
  maxTokens: {
    type: OptionType.SLIDER,
    description: "Maximum number of tokens in the response",
    default: 500,
    markers: [100, 250, 500, 1000, 2000],
    minValue: 50,
    maxValue: 4000,
    stickToMarkers: false,
  },
  temperature: {
    type: OptionType.SLIDER,
    description: "Response creativity (0 = very precise, 1 = very creative)",
    default: 0.7,
    markers: [0, 0.3, 0.7, 1.0],
    minValue: 0,
    maxValue: 1,
    stickToMarkers: false,
  },
  systemPrompt: {
    type: OptionType.STRING,
    description: "System prompt to customize ChatGPT's behavior",
    default:
      "You are a helpful and friendly assistant. Respond concisely and clearly.",
    placeholder: "You are an assistant...",
  },
  enableNotifications: {
    type: OptionType.BOOLEAN,
    description: "Show notifications for errors and successes",
    default: true,
  },
});

// Global variables
let isInitialized = false;
let isProcessing = false;

// Function to display notifications
function notify(title: string, body: string, isError = false) {
  if (!settings.store.enableNotifications) return;

  showNotification({
    title: isError ? `❌ ${title}` : `✅ ${title}`,
    body,
    icon: undefined,
  });
}

// Function to validate the API key
function validateApiKey(apiKey: string): boolean {
  return !!(
    apiKey &&
    (apiKey.startsWith("sk-") || apiKey.startsWith("sk-proj-")) &&
    apiKey.length > 20
  );
}

// Function to call ChatGPT via fetch (without OpenAI dependency)
async function callChatGPT(prompt: string): Promise<string> {
  const apiKey = settings.store.apiKey.trim();

  if (!validateApiKey(apiKey)) {
    throw new Error(
      "Invalid API key. Please configure a valid API key in the plugin settings."
    );
  }

  const requestBody = {
    model: settings.store.model,
    messages: [
      {
        role: "system",
        content: settings.store.systemPrompt,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: Math.round(settings.store.maxTokens),
    temperature: Math.round(settings.store.temperature * 100) / 100,
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let errorMessage = `API Error (${response.status})`;

    if (errorData.error?.message) {
      errorMessage += `: ${errorData.error.message}`;
    } else if (response.status === 401) {
      errorMessage += ": Invalid or expired API key";
    } else if (response.status === 429) {
      errorMessage += ": Rate limit reached, please try again later";
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error("Unexpected response from OpenAI API");
  }

  return data.choices[0].message.content.trim();
}

export default definePlugin({
  name: "ChatGPT",
  description:
    "Allows using ChatGPT directly in Discord with configurable settings",
  authors:  [Devs.rz30,],
  dependencies: ["CommandsAPI"],
  settings,
  commands: [
    {
      inputType: ApplicationCommandInputType.BUILT_IN,
      name: "chatgpt",
      description: "Ask ChatGPT a question",
      options: [
        {
          name: "question",
          description: "Your question for ChatGPT",
          type: ApplicationCommandOptionType.STRING,
          required: true,
        },
      ],
      execute: async (opts, ctx) => {
        try {
          const question = opts.find((opt) => opt.name === "question")?.value;

          if (!question) {
            sendBotMessage(ctx.channel.id, {
              content: "❌ No question provided!",
            });
            return;
          }

          // Check if a request is in progress
          if (isProcessing) {
            sendBotMessage(ctx.channel.id, {
              content:
                "⏳ A ChatGPT request is already in progress. Please wait...",
            });
            return;
          }

          // Use the API key from settings
          const apiKey = settings.store.apiKey;

          if (!validateApiKey(apiKey)) {
            sendBotMessage(ctx.channel.id, {
              content:
                "❌ API key not configured or invalid. Configure your key in the ChatGPT plugin settings.",
            });
            return;
          }

          isProcessing = true;

          const response = await callChatGPT(question as string);

          notify("ChatGPT", "Response generated successfully");

          sendBotMessage(ctx.channel.id, {
            content: `🤖 **ChatGPT** (${settings.store.model}):\n\n${response}`,
          });
        } catch (error) {
          console.error("[ChatGPT] Error executing command:", error);
          const errorMessage =
            error instanceof Error
              ? error.message
              : "An error occurred while communicating with ChatGPT.";

          notify("ChatGPT Error", errorMessage, true);

          sendBotMessage(ctx.channel.id, {
            content: `❌ **ChatGPT Error**: ${errorMessage}`,
          });
        } finally {
          isProcessing = false;
        }
      },
    },
    {
      inputType: ApplicationCommandInputType.BUILT_IN,
      name: "chatgpt-info",
      description: "Display information about ChatGPT configuration",
      options: [],
      execute: async (opts, ctx) => {
        const hasValidKey = validateApiKey(settings.store.apiKey);
        const keyStatus = hasValidKey
          ? "✅ Configured"
          : "❌ Not configured or invalid";

        sendBotMessage(ctx.channel.id, {
          content:
            `🤖 **ChatGPT Configuration**\n\n` +
            `**API Key**: ${keyStatus}\n` +
            `**Model**: ${settings.store.model}\n` +
            `**Max Tokens**: ${settings.store.maxTokens}\n` +
            `**Temperature**: ${settings.store.temperature}\n` +
            `**Status**: ${isProcessing ? "⏳ Processing" : "🟢 Ready"}\n\n` +
            `${!hasValidKey
              ? "⚠️ Configure your API key in the plugin settings."
              : ""
            }`,
        });
      },
    },
  ],
  start() {
    if (isInitialized) {
      console.log("[ChatGPT] Plugin is already initialized");
      return;
    }

    try {
      console.log("[ChatGPT] Initializing plugin...");

      const hasValidKey = validateApiKey(settings.store.apiKey);

      if (!hasValidKey) {
        notify(
          "ChatGPT Plugin",
          "API key not configured. Configure your key in the plugin settings.",
          true
        );
      } else {
        notify("ChatGPT Plugin", "Plugin enabled successfully!");
      }

      isInitialized = true;
      console.log("[ChatGPT] Plugin initialized successfully");
    } catch (error) {
      console.error("[ChatGPT] Error initializing plugin:", error);
      isInitialized = false;
      throw error;
    }
  },
  stop() {
    console.log("[ChatGPT] Stopping plugin...");
    isInitialized = false;
    isProcessing = false;
    notify("ChatGPT Plugin", "Plugin disabled");
  },
});
