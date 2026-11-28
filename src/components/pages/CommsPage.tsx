import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUp,
  BellRing,
  CircleCheck,
  Clock,
  Coins,
  FileText,
  Fingerprint,
  Hash,
  Radio,
  Smartphone,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { DashPage, Pill, RoleBadge } from '@/components/dash/kit';
import { docState } from '@/components/dash/docState';
import { ModeTrack } from '@/components/dash/ModeTrack';
import { usePortfolio } from '@/components/dash/usePortfolio';
import { RoleAvatar } from '@/components/hud/ui';
import { CHANNEL_BY_ID, CHANNELS, type ChannelId, type ChatMessage, type ChipKind, type MsgChip } from '@/data/comms';
import { FLEET } from '@/data/fleet';
import { FLAGSHIP, ROLE_ORDER, ROLES, type Role, type ShipmentId, type UlipId } from '@/data/shipment';
import { formatDay, formatStamp, formatTime } from '@/lib/format';
import { TONE_HEX, type Tone } from '@/lib/palette';
import { milestoneStatuses } from '@/lib/schedule';
import type { ViewId } from '@/lib/routes';
import { partyOf, ULIP_BY_ID, unreadCount, useScheduleFor, useShipment } from '@/store/shipment';

export default function CommsPage() {
  return (
    <DashPage view="comms" fill subtitle="One room per shipment instead of scattered emails and WhatsApp groups. Every message carries its milestone, document or payment as structured data.">
      <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_300px] gap-4 max-xl:grid-cols-[230px_minmax(0,1fr)] max-lg:grid-cols-1">
        <Channels />
        <Thread />
        <MiniBrief />
      </div>
    </DashPage>
  );
}

const panel = 'glass min-h-0 rounded-[20px]';

/* --- Channels --------------------------------------------------------------------------- */

function Channels() {
  const channel = useShipment((s) => s.channel);
  const setChannel = useShipment((s) => s.setChannel);
  const messages = useShipment((s) => s.messages);
  const readUpTo = useShipment((s) => s.readUpTo);
  const groups: { label: string; ids: ChannelId[] }[] = [
    { label: 'Shipments', ids: ['shp-0482', 'shp-0519', 'shp-0494'] },
    { label: 'Alerts', ids: ['customs'] },
  ];
  return (
    <nav className={`${panel} scroll-quiet flex flex-col overflow-y-auto p-3 max-lg:hidden`} aria-label="Channels">
      {groups.map((g) => (
        <div key={g.label} className="mb-3">
          <div className="eyebrow px-2 pb-1.5">{g.label}</div>
          <ul className="space-y-0.5">
            {g.ids.map((id) => {
              const c = CHANNEL_BY_ID[id];
              const last = [...messages].reverse().find((m) => m.channel === id);
              const n = unreadCount({ messages, readUpTo }, id);
              const active = channel === id;
              return (
                <li key={id}>
                  <button
                    onClick={() => setChannel(id)}
                    aria-current={active ? 'true' : undefined}
                    className="relative w-full rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-900/[0.035]"
                  >
                    {active && (
                      <motion.span
                        layoutId="channel-pill"
                        className="absolute inset-0 rounded-xl bg-cobalt/[0.07] shadow-[inset_0_0_0_1px_rgb(37_99_235/0.18)]"
                        transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                      />
                    )}
                    <span className="relative flex items-center gap-1.5">
                      {id === 'customs' ? <BellRing size={13} className="shrink-0 text-crimson" /> : <Hash size={13} className="shrink-0 text-subtle" />}
                      <span className={`num truncate text-[11.5px] ${n ? 'font-bold text-ink' : active ? 'font-semibold text-ink' : 'font-medium text-muted'}`}>{c.name.slice(1)}</span>
                      {n > 0 && <span className="num ml-auto grid h-[17px] min-w-[17px] place-items-center rounded-full bg-crimson px-1 text-[9.5px] font-bold text-white">{n}</span>}
                    </span>
                    {last && (
                      <span className="relative mt-0.5 block truncate pl-[19px] text-[10.5px] text-subtle">
                        {authorName(last)}: {last.text}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="mt-auto rounded-xl bg-slate-900/[0.025] p-2.5 text-[10.5px] leading-snug text-muted">
        <span className="font-semibold text-ink">Every party, one room.</span> The exporter, forwarder, CHA and driver read the same thread, and the driver needs no app install.
      </div>
    </nav>
  );
}

/* --- Authors ------------------------------------------------------------------------------ */

function authorName(m: ChatMessage): string {
  if (m.author === 'ai') return 'AI Co-Pilot';
  if (m.author === 'system') return 'One Platform';
  if (m.author in ROLES) return ROLES[m.author as Role].short;
  return ULIP_BY_ID[m.author as UlipId]?.name ?? 'System';
}

function Avatar({ m }: { m: ChatMessage }) {
  if (m.author in ROLES) return <RoleAvatar role={m.author as Role} shipment={m.shipment ?? FLAGSHIP} size={34} />;
  const Icon: LucideIcon = m.author === 'ai' ? Sparkles : m.author === 'system' ? Hash : Radio;
  return (
    <span
      className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-white"
      style={{
        background:
          m.author === 'ai'
            ? 'linear-gradient(135deg, #2563EB, #7C9BFF)'
            : m.author === 'system'
              ? 'linear-gradient(135deg, #334155, #64748B)'
              : 'linear-gradient(135deg, #0284C7, #38BDF8)',
      }}
    >
      <Icon size={15} />
    </span>
  );
}

const CHIP_ICON: Record<ChipKind, LucideIcon> = {
  milestone: CircleCheck,
  doc: FileText,
  escrow: Coins,
  eta: Clock,
  alert: TriangleAlert,
  hash: Fingerprint,
};

/** Where a chip leads: documents and hashes to the vault, money to Financials, the rest to the globe. */
function chipTarget(chip: MsgChip): { view: ViewId; label: string } {
  if (chip.kind === 'doc' || chip.kind === 'hash') return { view: 'documents', label: 'Open in the Document Vault' };
  if (chip.kind === 'escrow') return { view: 'financials', label: 'Open the escrow pipeline' };
  if (chip.kind === 'alert' && /mismatch|rms|examination|hold/i.test(chip.label)) return { view: 'documents', label: 'Open the documents behind this alert' };
  return { view: 'tower', label: 'Show on the Control Tower' };
}

function MessageChip({ chip, shipment, removable, onRemove }: { chip: MsgChip; shipment?: ShipmentId | null; removable?: boolean; onRemove?: () => void }) {
  const Icon = CHIP_ICON[chip.kind];
  const hex = TONE_HEX[chip.tone];
  const setView = useShipment((s) => s.setView);
  const select = useShipment((s) => s.selectShipment);
  const target = chipTarget(chip);
  const style = { color: hex, background: `color-mix(in oklab, ${hex} 8%, white)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${hex} 22%, transparent)` };
  const cls = `inline-flex h-[22px] items-center gap-1 rounded-lg px-2 text-[10.5px] font-semibold ${chip.kind === 'hash' || chip.kind === 'doc' ? 'num' : ''}`;
  if (removable)
    return (
      <span className={cls} style={style}>
        <Icon size={11} />
        {chip.label}
        <button onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100" aria-label={`Remove ${chip.label}`}>
          ×
        </button>
      </span>
    );
  return (
    <button
      onClick={() => {
        if (shipment) select(shipment);
        setView(target.view);
      }}
      title={target.label}
      className={`${cls} transition-transform hover:-translate-y-px hover:brightness-95 active:translate-y-0`}
      style={style}
    >
      <Icon size={11} />
      {chip.label}
    </button>
  );
}

/* --- Thread ----------------------------------------------------------------------------- */

const QUICK = ["What's the ETA?", 'Are the documents reconciled?'];

function Thread() {
  const channel = useShipment((s) => s.channel);
  const setChannel = useShipment((s) => s.setChannel);
  const all = useShipment((s) => s.messages);
  const typing = useShipment((s) => s.typing);
  const markRead = useShipment((s) => s.markRead);
  const escalate = useShipment((s) => s.escalate);
  const nowH = useShipment((s) => s.nowH);
  const c = CHANNEL_BY_ID[channel];
  const messages = useMemo(() => all.filter((m) => m.channel === channel), [all, channel]);
  const shipment = c.shipment ?? useShipment.getState().selected;
  const scroller = useRef<HTMLDivElement>(null);

  // Reading the channel marks it read, including messages that arrive while it is open.
  useEffect(() => {
    markRead(channel);
  }, [channel, messages.length, markRead]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: messages.length ? 'smooth' : 'auto' });
  }, [messages.length, channel, typing]);

  const today = formatDay(nowH);
  const yesterday = formatDay(nowH - 24);

  return (
    <section className={`${panel} flex flex-col overflow-hidden`} aria-label={`${c.name} thread`}>
      <header className="flex items-center gap-3 border-b border-[rgba(15,23,42,0.06)] px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="num truncate text-[14px] font-semibold text-ink max-lg:sr-only">{c.name}</h2>
            <label className="min-w-0 lg:hidden">
              <span className="sr-only">Channel</span>
              <select value={channel} onChange={(e) => setChannel(e.target.value as ChannelId)} className="num max-w-full truncate rounded-lg bg-slate-900/[0.05] py-1 pr-1 pl-2 text-[13px] font-semibold text-ink">
                {CHANNELS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="truncate text-[11px] text-muted">{c.topic}</div>
        </div>
        <div className="flex -space-x-1.5 max-sm:hidden">
          {ROLE_ORDER.map((r) => (
            <span key={r} className="rounded-full ring-2 ring-white">
              <RoleAvatar role={r} shipment={shipment} size={24} />
            </span>
          ))}
        </div>
        <button
          onClick={escalate}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber/30 bg-amber/[0.06] px-2.5 text-[11.5px] font-semibold text-amber transition-colors hover:bg-amber/[0.12]"
          title="Escalate to whoever holds the baton, with a 2-hour response SLA"
        >
          <TriangleAlert size={13} /> Escalate
        </button>
      </header>

      <div ref={scroller} className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {messages.map((m, i) => {
          const day = formatDay(m.h);
          const newDay = i === 0 || formatDay(messages[i - 1].h) !== day;
          const grouped = !newDay && messages[i - 1].author === m.author && m.h - messages[i - 1].h < 0.5 && !m.mine === !messages[i - 1].mine;
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-[rgba(15,23,42,0.07)]" />
                  <span className="text-[10px] font-semibold tracking-[0.1em] text-subtle uppercase">{day === today ? 'Today' : day === yesterday ? 'Yesterday' : day}</span>
                  <span className="h-px flex-1 bg-[rgba(15,23,42,0.07)]" />
                </div>
              )}
              <Message m={m} grouped={grouped} />
            </div>
          );
        })}
        <AnimatePresence>
          {typing && typing.channel === channel && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 flex items-center gap-2 pl-[46px] text-[11px] text-muted">
              <span className="flex gap-0.5">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-subtle"
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                  />
                ))}
              </span>
              {typing.author in ROLES ? partyOf(useShipment.getState().assignments, typing.shipment ?? FLAGSHIP, typing.author as Role).person : authorName({ author: typing.author } as ChatMessage)} is typing…
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Composer quick={QUICK} />
    </section>
  );
}

function Message({ m, grouped }: { m: ChatMessage; grouped: boolean }) {
  const assignments = useShipment((s) => s.assignments);
  const role = m.author in ROLES ? (m.author as Role) : null;
  const party = role ? partyOf(assignments, m.shipment ?? FLAGSHIP, role) : null;
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`group flex gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-900/[0.02] ${grouped ? '-mt-1' : 'mt-1.5'} ${m.mine ? 'bg-cobalt/[0.03]' : ''}`}
    >
      <div className="w-[34px] shrink-0">{!grouped && <Avatar m={m} />}</div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-[12.5px] font-semibold text-ink">{party?.person ?? authorName(m)}</span>
            {role && <RoleBadge role={role} className="translate-y-[-1px]" />}
            {m.author === 'ai' && <span className="rounded-md bg-cobalt/[0.08] px-1.5 text-[9.5px] font-bold text-cobalt">AI</span>}
            <span className="truncate text-[10.5px] text-subtle">{party?.org ?? (m.author in ULIP_BY_ID ? ULIP_BY_ID[m.author as UlipId].system : 'Automation')}</span>
            {m.shipment && m.channel === 'customs' && <span className="num text-[10px] text-subtle">· {m.shipment.slice(-4)}</span>}
            {m.mine && <span className="text-[10px] font-semibold text-cobalt">· You</span>}
            {m.via === 'driver-app' && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-violet/[0.08] px-1.5 text-[9.5px] font-semibold text-violet">
                <Smartphone size={9} /> via Driver app
              </span>
            )}
            <span className="num ml-auto text-[10px] text-subtle opacity-70">{formatTime(m.h)}</span>
          </div>
        )}
        <div className="text-[12.5px] leading-relaxed text-ink">{m.text}</div>
        {m.chips && m.chips.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {m.chips.map((c, i) => (
              <MessageChip key={i} chip={c} shipment={m.shipment} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Composer({ quick }: { quick: string[] }) {
  const role = useShipment((s) => s.role);
  const channel = useShipment((s) => s.channel);
  const post = useShipment((s) => s.postMessage);
  const shipment = useShipment((s) => CHANNEL_BY_ID[s.channel].shipment ?? s.selected);
  const person = useShipment((s) => partyOf(s.assignments, CHANNEL_BY_ID[s.channel].shipment ?? s.selected, s.role).person);
  const driver = useShipment((s) => partyOf(s.assignments, CHANNEL_BY_ID[s.channel].shipment ?? s.selected, 'transporter').person);
  const [text, setText] = useState('');
  const [attached, setAttached] = useState<MsgChip[]>([]);
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = (t = text) => {
    if (!t.trim() && !attached.length) return;
    post(t.trim() || 'Attaching for reference.', { chips: attached.length ? attached : undefined });
    setText('');
    setAttached([]);
    ref.current?.focus();
  };

  // The channel's title document: the e-BL for ocean, the house air waybill for air.
  const titleDoc = FLEET[shipment].documents.find((d) => d.id === 'ebl' || d.id === 'awb');
  const attach = () => {
    if (!titleDoc) return;
    const chip: MsgChip = { kind: 'doc', label: `${titleDoc.name} · ${titleDoc.ref}`, tone: 'cobalt' };
    setAttached((a) => (a.some((x) => x.label === chip.label) ? a : [...a, chip]));
    ref.current?.focus();
  };
  const pingDriver = () => post(`@${driver} can you share your position and ETA to the gate?`, { intent: 'ping-driver' });
  const escalateCha = () =>
    post(`Escalating to the CHA: please prioritise customs on ${shipment}.`, {
      intent: 'escalate-cha',
      chips: [{ kind: 'alert', label: 'Escalated to CHA · SLA 2h', tone: 'amber' }],
    });
  const insertCls =
    'h-7 rounded-full bg-cobalt/[0.07] px-2.5 text-[11px] font-semibold text-cobalt shadow-[inset_0_0_0_1px_rgb(37_99_235/0.15)] transition-colors hover:bg-cobalt/[0.12]';

  return (
    <div className="border-t border-[rgba(15,23,42,0.06)] px-4 pt-2.5 pb-3">
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button onClick={attach} className={insertCls}>
          + Attach {titleDoc?.id === 'awb' ? 'HAWB' : 'e-BL'}
        </button>
        <button onClick={pingDriver} className={insertCls}>
          + Ping Driver
        </button>
        <button onClick={escalateCha} className={insertCls}>
          + Escalate to CHA
        </button>
        <span className="mx-0.5 h-7 w-px bg-[rgba(15,23,42,0.08)]" />
        {quick.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            className="h-7 rounded-full bg-slate-900/[0.04] px-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-cobalt/[0.08] hover:text-cobalt"
          >
            {q}
          </button>
        ))}
      </div>
      {attached.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {attached.map((c) => (
            <MessageChip key={c.label} chip={c} removable onRemove={() => setAttached((a) => a.filter((x) => x.label !== c.label))} />
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-2xl bg-white p-2 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)] focus-within:shadow-[inset_0_0_0_1.5px_rgb(37_99_235/0.55),0_0_0_4px_rgb(37_99_235/0.08)]">
        <span className="mb-0.5 flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900/[0.04] py-1 pr-2 pl-1" title={`Posting as ${ROLES[role].label}`}>
          <RoleAvatar role={role} shipment={CHANNEL_BY_ID[channel].shipment ?? undefined} size={20} />
          <RoleBadge role={role} />
        </span>
        <textarea
          ref={ref}
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={`Message as ${person}…`}
          aria-label="Message"
          className="max-h-28 min-h-[30px] flex-1 resize-none bg-transparent py-1 text-[12.5px] text-ink outline-none placeholder:text-subtle"
        />
        <button
          onClick={() => send()}
          disabled={!text.trim() && !attached.length}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cobalt text-white shadow-[0_6px_14px_-6px_rgb(37_99_235/0.8)] transition-all hover:brightness-110 active:scale-95 disabled:bg-slate-200 disabled:shadow-none"
          aria-label="Send message"
        >
          <ArrowUp size={15} strokeWidth={2.5} />
        </button>
      </div>
      <div className="mt-1.5 text-[10px] text-subtle">
        Enter to send · Shift+Enter for a new line · switch who you are acting as with the role switcher or keys 1–4
      </div>
    </div>
  );
}

/* --- Mini-brief ------------------------------------------------------------------------- */

function MiniBrief() {
  const channel = useShipment((s) => s.channel);
  const selected = useShipment((s) => s.selected);
  const id: ShipmentId = CHANNEL_BY_ID[channel].shipment ?? selected;
  const rows = usePortfolio();
  const row = rows.find((r) => r.id === id)!;
  const def = FLEET[id];
  const state = useShipment();
  const schedule = useScheduleFor(id);
  const statuses = milestoneStatuses(schedule, state.nowH, state.nowH);
  const pinned = def.documents.slice(0, 3);
  const driver = state.messages.filter((m) => m.via === 'driver-app' && m.shipment === id).slice(-3).reverse();
  const next = schedule.milestones.find((m) => statuses[m.id] !== 'done');
  const holderTone: Tone = ROLES[row.baton.role].tone;

  return (
    <aside className={`${panel} scroll-quiet overflow-y-auto p-4 max-xl:hidden`} aria-label="Active shipment brief">
      <div className="eyebrow">Active shipment brief</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="num text-[13px] font-semibold text-ink">{id}</span>
        <Pill tone={row.status.tone} pulse={row.status.alert}>
          {row.status.label}
        </Pill>
      </div>
      <div className="text-[12px] text-muted">
        {def.origin} → {def.destination} · {def.carrier}
      </div>
      <div className="mt-3 rounded-xl bg-[#F7F9FC] px-2 pt-1 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.04)]">
        <ModeTrack legs={row.legs} labels width={260} />
      </div>

      <div className="mt-3 rounded-2xl p-3" style={{ background: `color-mix(in oklab, ${TONE_HEX[holderTone]} 6%, white)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${TONE_HEX[holderTone]} 18%, transparent)` }}>
        <div className="eyebrow" style={{ color: TONE_HEX[holderTone] }}>
          Baton holder
        </div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <RoleAvatar role={row.baton.role} shipment={id} size={34} ring />
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
              {row.baton.person} <RoleBadge role={row.baton.role} />
            </div>
            <div className="truncate text-[11px] text-muted">{row.baton.task}</div>
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-xl bg-slate-900/[0.025] px-2.5 py-2">
          <dt className="text-[9px] font-semibold tracking-[0.1em] text-subtle uppercase">ETA {def.destination}</dt>
          <dd className="num mt-0.5 font-semibold text-ink">{formatStamp(schedule.deliveredH, def.destTz).slice(0, 16)}</dd>
        </div>
        <div className="rounded-xl bg-slate-900/[0.025] px-2.5 py-2">
          <dt className="text-[9px] font-semibold tracking-[0.1em] text-subtle uppercase">Next milestone</dt>
          <dd className="mt-0.5 truncate font-semibold text-ink">{next?.label ?? 'Delivered'}</dd>
        </div>
      </dl>

      <div className="eyebrow mt-4 mb-1.5">Pinned documents</div>
      <ul className="space-y-1.5">
        {pinned.map((d) => {
          const st = docState(id, d, state, statuses);
          return (
            <li key={d.id} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]">
              <FileText size={13} className="shrink-0 text-muted" />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[11.5px] font-semibold text-ink">{d.name}</div>
                <div className="num truncate text-[10px] text-subtle">{d.ref}</div>
              </div>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONE_HEX[st.tone] }} title={st.label} />
            </li>
          );
        })}
      </ul>

      <div className="eyebrow mt-4 mb-1.5 flex items-center gap-1.5">
        <Smartphone size={11} /> Synced from the driver app
      </div>
      {driver.length ? (
        <ul className="space-y-1.5">
          {driver.map((m) => (
            <li key={m.id} className="rounded-xl bg-violet/[0.05] px-2.5 py-2 text-[11px] leading-snug text-ink shadow-[inset_0_0_0_1px_rgb(124_58_237/0.12)]">
              <div className="num mb-0.5 text-[9.5px] font-semibold text-violet">{formatTime(m.h)} · {partyOf(state.assignments, id, 'transporter').person}</div>
              {m.text}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-[11px] text-subtle">No driver updates yet.</div>
      )}
      {id === FLAGSHIP && state.actuals.gateIn === undefined && (
        <button
          onClick={() => {
            state.setView('tower');
            state.setPhone(true);
          }}
          className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl bg-violet/[0.08] text-[11.5px] font-semibold text-violet transition-colors hover:bg-violet/[0.14]"
        >
          <Smartphone size={13} /> Open driver simulator
        </button>
      )}
    </aside>
  );
}
