import "./styles.css";
import { addChatBarButton, removeChatBarButton, ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import definePlugin from "@utils/types";
import { waitFor } from "@webpack";
import { React, useEffect, useRef, useState, Menu, ContextMenuApi } from "@webpack/common";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { EquicordDevs } from "@utils/constants";

let lastFormats = new Set();
let ChannelTextAreaClasses;

const FORMAT_KEYS = [
  { label: "Bold", tag: "**", icon: `<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>` },
  { label: "Italic", tag: "*", icon: `<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z" fill="none"/><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>` },
  { label: "Strike", tag: "~~", icon: `<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z" fill="none"/><path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/></svg>` },
  { label: "Underline", tag: "_", icon: `<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>` },
  { label: "Inline Code", tag: "`", icon: `<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>` },
  { label: "Codeblock", tag: "```", icon: `<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7.77 6.76L6.23 5.48.82 12l5.41 6.52 1.54-1.28L3.42 12l4.35-5.24zM7 13h2v-2H7v2zm10-2h-2v2h2v-2zm-6 2h2v-2h-2v2zm6.77-7.52l-1.54 1.28L20.58 12l-4.35 5.24 1.54 1.28L23.18 12l-5.41-6.52z"/></svg>` },
  { label: "Blockquote", tag: ">", icon: `<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z" fill="none"/><path d="M7 7h4v2H7zm0 4h4v2H7zm0 4h4v2H7zm6-8h4v2h-4zm0 4h4v2h-4zm0 4h4v2h-4z"/></svg>` },
  { label: "Unordered List", tag: "-", icon: `<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z" fill="none"/><path d="M4 10.5c0 .83-.67 1.5-1.5 1.5S1 11.33 1 10.5 1.67 9 2.5 9 4 9.67 4 10.5zM4 4.5C4 5.33 3.33 6 2.5 6S1 5.33 1 4.5 1.67 3 2.5 3 4 3.67 4 4.5zM4 16.5c0 .83-.67 1.5-1.5 1.5S1 17.33 1 16.5 1.67 15 2.5 15 4 15.67 4 16.5zM6 5h14v2H6zm0 6h14v2H6zm0 6h14v2H6z"/></svg>` },
  { label: "Spoiler", tag: "||", icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" fill="white" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>` },
  { label: "Superscript", tag: "ˢᵘᵖᵉʳˢᶜʳᶦᵖᵗ", icon: `<svg fill="white" height="24" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/><path d="M0 0h24v24H0z" fill="none"/></svg>` },
  { label: "Smallcaps", tag: "SᴍᴀʟʟCᴀᴘs", icon: `<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"/></svg>` },
  { label: "Fullwidth", tag: "Ｆｕｌｌｗｉｄｔｈ", icon: `<svg fill="white" height="24" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><text x="2" y="16" font-size="12" fill="white">Ｆｕｌｌｗｉｄｔｈ</text></svg>` },
  { label: "Upsidedown", tag: "uʍopǝpᴉsd∩", icon: `<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/></svg>` },
  { label: "Varied", tag: "VaRiEd CaPs", icon: `<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M18 4l-4 4h3v7c0 1.1-.9 2-2 2s-2-.9-2-2V8c0-2.21-1.79-4-4-4S5 5.79 5 8v7H2l4 4 4-4H7V8c0-1.1.9-2 2-2s2 .9 2 2v7c0 2.21 1.79 4 4 4s4-1.79 4-4V8h3l-4-4z"/></svg>` },
  { label: "Leet", tag: "1337", icon: `<svg fill="white" height="24" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><text x="2" y="16" font-size="12" fill="white">1337</text></svg>` },
  { label: "Extra Thicc", tag: "乇乂下尺卂 下卄工匚匚", icon: `<svg fill="white" height="24" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><text x="2" y="16" font-size="10" fill="white">乇乂下尺卂 下卄工匚匚</text></svg>` }
];

const allLanguages = (() => {
  return {
    C: { cpp: "C++", csharp: "C#", coffeescript: "CoffeeScript", css: "CSS" },
    H: { html: "HTML/XML" },
    J: { java: "Java", js: "JavaScript", json: "JSON" },
    M: { markdown: "Markdown" },
    P: { perl: "Perl", php: "PHP", py: "Python" },
    R: { ruby: "Ruby" },
    S: { sql: "SQL" },
    V: { vbnet: "VB.NET", vhdl: "VHDL" },
  };
})();

const getChatInputText = () => {
  const chatTextArea = document.querySelector(`.${ChannelTextAreaClasses && ChannelTextAreaClasses.channelTextArea ? ChannelTextAreaClasses.channelTextArea : ''}`);
  if (!chatTextArea) return "";
  const chatInput = chatTextArea.querySelector('div[contenteditable="true"]');
  if (!chatInput) return "";
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (chatInput.contains(range.commonAncestorContainer)) {
      return range.toString().trim();
    }
  }
  return "";
};

const formatFrame = { current: null as HTMLDivElement | null };

const FormatButton: ChatBarButtonFactory = () => {
  const [open, setOpen] = useState(false);
  const [activeTags] = useState(new Set(lastFormats));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<string>("");
  function ContextMenu() {

  const handleInsertCodeblock = (lang: string) => {
    const selectedText = getChatInputText();
    const codeblock = `\u0060\u0060\u0060${lang}\n${selectedText || ""}\n\u0060\u0060\u0060`;
    insertTextIntoChatInputBox(codeblock);
  };
  return (
    <Menu.Menu
      navId="codeblock-languages"
      onClose={ContextMenuApi.closeContextMenu}
    >
      <Menu.MenuGroup>
      {Object.entries(allLanguages).map(([letter, langs]) => (
        <Menu.MenuItem
        key={letter}
        id={`lang-group-${letter}`}
        label={letter}
        >
        <>
          {Object.entries(langs as Record<string, string>).map(([lang, label]) => (
          <Menu.MenuItem
            key={lang}
            id={`lang-${lang}`}
            label={label as React.ReactNode}
            action={() => { handleInsertCodeblock(lang);}}
          />
          ))}
        </>
        </Menu.MenuItem>
      ))}
      </Menu.MenuGroup>
    </Menu.Menu>
  );
  }
  useEffect(() => {
    formatFrame.current?.remove();
    formatFrame.current = null;
    if (!open || !wrapperRef.current) return;
  
    const panel = document.createElement("div");
    formatFrame.current = panel;
    Object.assign(panel.style, {
        position: "fixed",
        display: "flex",
        flexWrap: "nowrap",
        gap: "4px",
        padding: "4px 2px",
        background: "var(--background-mod-strong)",
        border: "1px solid var(--interactive-muted)",
        borderRadius: "4px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        zIndex: 100000,
        animation: "slide-up 300ms cubic-bezier(0,0,0,1), opacity 300ms ease",
        transition: "all 200ms ease",
      });
  
    FORMAT_KEYS.forEach(({ label, tag, icon }) => {
        const btn = document.createElement("button");
        btn.innerHTML = icon;
        Object.assign(btn.style, {
          width: "28px",
          height: "28px",
          padding: "4px",
          border: "none",
          borderRadius: "3px",
          cursor: "pointer",
          background: activeTags.has(tag)
            ? "var(--button-secondary-background-hover)"
            : "var(--button-secondary-background)",
          color: activeTags.has(tag) ? "var(--text-normal)" : "var(--text-muted)",
          fontWeight: "normal"
        });
      
        btn.onmouseover = () => {
          document.querySelectorAll(".tooltip").forEach(el => el.remove());
      
          const tooltip = document.createElement("div");
          tooltip.className = "tooltip";
          tooltip.textContent = label;
          Object.assign(tooltip.style, {
            position: "absolute",
            top: `${btn.getBoundingClientRect().top - btn.offsetHeight - 8}px`,
            left: `${btn.getBoundingClientRect().left + btn.offsetWidth / 2}px`, 
            transform: "translateX(-50%)", 
            background: "black",
            color: "var(--text-normal)",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            pointerEvents: "none",
            zIndex: 100001,
            textAlign: "center"
          });
          document.body.appendChild(tooltip);
          btn.style.background = "black";
          btn.style.color = "white";
        };
      
        btn.onmouseleave = () => {
          document.querySelectorAll(".tooltip").forEach(el => el.remove());
          btn.style.background = activeTags.has(tag)
            ? "black"
            : "var(--button-secondary-background)";
          btn.style.color = activeTags.has(tag) ? "white" : "var(--text-muted)";
        };


        btn.oncontextmenu = (e) => {
        if (tag === "```") {
          e.preventDefault();
          ContextMenuApi.openContextMenu(e, () => <ContextMenu />);
        }
      };
      
        btn.onclick = () => {
          const currentText = getChatInputText();
          if (!currentText) ""
          const replaceList = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}";
          const smallCapsList = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ{|}";
          const superscriptList = " !\"#$%&'⁽⁾*⁺,⁻./⁰¹²³⁴⁵⁶⁷⁸⁹:;<⁼>?@ᴬᴮᶜᴰᴱᶠᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾQᴿˢᵀᵁνᵂˣʸᶻ[\\]^_`ᵃᵇᶜᵈᵉᶠᵍʰᶦʲᵏˡᵐⁿᵒᵖᑫʳˢᵗᵘᵛʷˣʸᶻ{|}";
          const fullwidthList = "　！＂＃＄％＆＇（）＊＋，－．／０１２３４５６７８９：；＜＝＞？＠ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ［＼］＾＿｀ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ｛｜｝";
          const leetList = " !\"#$%&'()*+,-./0123456789:;<=>?@48CD3FG#IJK1MN0PQЯ57UVWXY2[\\]^_`48cd3fg#ijk1mn0pqЯ57uvwxy2{|}";
          const thiccList = "　!\"#$%&'()*+,-./0123456789:;<=>?@卂乃匚刀乇下厶卄工丁长乚从ん口尸㔿尺丂丅凵リ山乂丫乙[\\]^_`卂乃匚刀乇下厶卄工丁长乚从ん口尸㔿尺丂丅凵リ山乂丫乙{|}";

          const wrapOrUnwrap = (tag: string, text: string) =>
            text.startsWith(tag) && text.endsWith(tag)
              ? text.slice(tag.length, -tag.length)
              : `${tag}${text}${tag}`;

          const mapLines = (prefix: string, text: string) =>
            text
              .split("\n")
              .map(line => line.startsWith(prefix) ? line.slice(prefix.length) : `${prefix}${line}`)
              .join("\n");

          const mapChars = (list: string, text: string) =>
            text
              .split("")
              .map(char => list[replaceList.indexOf(char)] || char)
              .join("");

          let formattedText = "";

            switch (tag) {
              case "**":
              case "*":
              case "~~":
              case "_":
              case "`":
              case "||":
                formattedText = wrapOrUnwrap(tag, currentText);
                break;
              case "```":
                formattedText =
                  currentText.startsWith("```") && currentText.endsWith("```")
                    ? currentText.slice(3, -3).trim()
                    : `\`\`\`\n${currentText}\n\`\`\``;
                break;
              case ">":
                formattedText = mapLines("> ", currentText);
                break;
              case "-":
                formattedText = mapLines("- ", currentText);
                break;
              case "ˢᵘᵖᵉʳˢᶜʳᶦᵖᵗ":
                formattedText = mapChars(superscriptList, currentText);
                break;
              case "SᴍᴀʟʟCᴀᴘs":
                formattedText = mapChars(smallCapsList, currentText);
                break;
              case "Ｆｕｌｌｗｉｄｔｈ":
                formattedText = mapChars(fullwidthList, currentText);
                break;
              case "uʍopǝpᴉsd∩":
                const upsideDownList = " ¡\"#$%℘,)(*+'-˙/0ƖᄅƐㄣϛ9ㄥ86:;>=<¿@∀qƆpƎℲפHIſʞ˥WNOԀQɹS┴∩ΛMXλZ]\\[^‾,ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz}|{";
                formattedText = mapChars(upsideDownList, currentText).split("").reverse().join("");
                break;
              case "VaRiEd CaPs":
                formattedText = currentText
                  .split("")
                  .map((char, i) => (i % 2 === 0 ? char.toUpperCase() : char.toLowerCase()))
                  .join("");
                break;
              case "1337":
                formattedText = mapChars(leetList, currentText);
                break;
              case "乇乂下尺卂 下卄工匚匚":
                formattedText = mapChars(thiccList, currentText);
                break;
              default:
                formattedText = currentText;
            }
            insertTextIntoChatInputBox(formattedText);

            panel.querySelectorAll("button").forEach((b, i) => {
              const t = FORMAT_KEYS[i].tag;
              (b as HTMLButtonElement).style.background = activeTags.has(t)
                ? "black"
                : "var(--button-secondary-background)";
              (b as HTMLButtonElement).style.color = activeTags.has(t)
                ? "white"
                : "var(--text-muted)";
            });
          };
        
          panel.appendChild(btn);
      });
  
    document.body.append(panel);
    const rect = wrapperRef.current.getBoundingClientRect();
    const panelWidth = panel.offsetWidth;
    const viewportWidth = window.innerWidth;
    let leftPosition = rect.left + -300;
    if (leftPosition < 0) {
      leftPosition = 10;
    } else if (leftPosition + panelWidth > viewportWidth) {
      leftPosition = viewportWidth - panelWidth - 10;
    }

    panel.style.left = `${leftPosition}px`;
    panel.style.top = `${rect.top - panel.offsetHeight - 6}px`;
  
    return () => {
      panel.remove();
      formatFrame.current = null;
    };
  }, [open, activeTags]);

  return (
    <div
      ref={wrapperRef}
      style={{ position: "relative", display: "inline-block", zIndex: 9999 }}
      onMouseEnter={() => {
        if (!open) setTooltip("Formatting Options");
      }}
      onMouseLeave={() => {
        if (!open) setTooltip("");
      }}
    >
     <ChatBarButton
        tooltip={tooltip}
        onClick={(e) => {
          setOpen((o) => !o);
          setTooltip("");
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            d="m21.18 2.82-.45-1.2a.25.25 0 0 0-.46 0l-.45 1.2-1.2.45a.25.25 0 0 0 0 .46l1.2.45.45 1.2c.08.21.38.21.46 0l.45-1.2 1.2-.45a.25.25 0 0 0 0-.46l-1.2-.45ZM6.97 4.25l.76 2.02 2.02.76a.5.5 0 0 1 0 .94l-2.02.76-.76 2.02a.5.5 0 0 1-.94 0l-.76-2.02-2.02-.76a.5.5 0 0 1 0-.94l2.02-.76.76-2.02a.5.5 0 0 1 .94 0ZM18.53 7.6c.3-.3.3-.78 0-1.07l-1.06-1.06a.75.75 0 0 0-1.06 0l-1.94 1.94c-.3.3-.3.77 0 1.06l1.06 1.06c.3.3.77.3 1.06 0l1.94-1.94ZM14.53 11.6c.3-.3.3-.78 0-1.07l-1.06-1.06a.75.75 0 0 0-1.06 0l-9.94 9.94c-.3.3-.3.77 0 1.06l1.06 1.06c.3.3.77.3 1.06 0l9.94-9.94ZM20.73 13.27l-.76-2.02a.5.5 0 0 0-.94 0l-.76 2.02-2.02.76a.5.5 0 0 0 0 .94l2.02.76.76 2.02a.5.5 0 0 0 .94 0l.76-2.02 2.02-.76a.5.5 0 0 0 0-.94l-2.02-.76ZM10.73 1.62l.45 1.2 1.2.45c.21.08.21.38 0 .46l-1.2.45-.45 1.2a.25.25 0 0 1-.46 0l-.45-1.2-1.2-.45a.25.25 0 0 1 0-.46l1.2-.45.45-1.2a.25.25 0 0 1 .46 0Z"
          />
        </svg>
      </ChatBarButton>
    </div>
  );
};

export default definePlugin({
  name: "BetterFormattingRedux",
  description: "Adds a button to enable different text formatting options in the input-bar.",
  authors: [EquicordDevs.omaw],
  dependencies: ["MessageEventsAPI", "ChatInputButtonAPI"],
  start: () => {
    addChatBarButton("FormatButton", FormatButton);
    waitFor(["buttonContainer", "channelTextArea"], (m) => (ChannelTextAreaClasses = m));
  },
  stop: () => {
    removeChatBarButton("FormatButton");
    formatFrame.current?.remove();
  }
});
