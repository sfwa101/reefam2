import { useEffect, useRef, useState } from "react";
import { X, Send, Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

export function HakimChatDrawer({
  open, onClose, contextLabel, contextData,
}: {
  open: boolean;
  onClose: () => void;
  contextLabel?: string;
  contextData?: Record<string, any>;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0 && contextData) {
      setMessages([{
        role: "assistant",
        content: `السلام عليكم 👋 — أنا حكيم. أمامي **${contextLabel ?? "أرقام الشاشة الحالية"}**. اسألني عن أي رقم أو خطة تحسين.`,
      }]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);

    // Prefix the user message with current page context (one-shot, not stored in UI)
    const ctxLine = contextData
      ? `[سياق الشاشة (${contextLabel ?? "data"}): ${JSON.stringify(contextData)}]\n\n`
      : "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hakim-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ message: ctxLine + text, session_id: sessionId }),
      });

      if (resp.status === 429) { toast.error("الطلبات كثيرة، حاول بعد دقيقة."); setBusy(false); return; }
      if (resp.status === 402) { toast.error("نفد رصيد الذكاء الاصطناعي."); setBusy(false); return; }
      if (!resp.ok || !resp.body) { toast.error("تعذر الاتصال بحكيم"); setBusy(false); return; }

      // Append empty assistant message and stream into it
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = ""; let acc = ""; let done = false;
      while (!done) {
        const r = await reader.read();
        if (r.done) break;
        buf += decoder.decode(r.value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(json);
            if (p?.meta?.session_id) setSessionId(p.meta.session_id);
            const c = p?.choices?.[0]?.delta?.content;
            if (c) {
              acc += c;
              setMessages((m) => {
                const next = [...m];
                next[next.length - 1] = { role: "assistant", content: acc };
                return next;
              });
            }
          } catch { /* partial */ }
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "خطأ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-background border-l border-border shadow-2xl flex flex-col transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-l from-primary/5 to-[hsl(var(--purple))]/5">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--purple))] text-white flex items-center justify-center shadow-sm">
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-display text-[15px] leading-tight">حكيم</p>
              <p className="text-[10.5px] text-foreground-tertiary">المستشار المالي الذكي</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center press">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-surface border border-border/40 rounded-bl-md prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-headings:font-display prose-strong:text-foreground",
                )}
              >
                {m.role === "assistant"
                  ? <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                  : <span>{m.content}</span>}
              </div>
            </div>
          ))}
          {busy && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-end">
              <div className="bg-surface border border-border/40 rounded-2xl rounded-bl-md px-3.5 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-foreground-tertiary" />
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-border/50 p-3 bg-surface">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="اسأل حكيم عن أي رقم في الشاشة…"
              rows={1}
              className="flex-1 resize-none bg-background border border-border/50 rounded-2xl px-4 py-2.5 text-[13.5px] outline-none focus:border-primary/50 max-h-32"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm disabled:opacity-50 press"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
