import { useState, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMaintenanceEvents,
  useCreateMaintenanceEvent,
  useUpdateMaintenanceEvent,
  useDeleteMaintenanceEvent,
  useListPmDocuments,
  useCreatePmDocument,
  useDeletePmDocument,
  useListModels,
  useRequestUploadUrl,
  getListMaintenanceEventsQueryKey,
  getListPmDocumentsQueryKey,
  type MaintenanceEvent,
  type PmDocument,
  type Model,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Upload,
  FileText,
  Download,
  Trash2,
  Calendar as CalendarIcon,
  ClipboardCheck,
  Loader2,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isBefore,
  startOfDay,
} from "date-fns";

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type EventStatus = "scheduled" | "completed" | "overdue";

interface EventDraft {
  title: string;
  scheduledDate: string; // yyyy-MM-dd
  scheduledTime: string; // HH:mm
  durationHours: string;
  modelId: string; // "" for none
  assignedTo: string;
  description: string;
  status: EventStatus;
}

function emptyDraft(initialDate?: Date): EventDraft {
  const d = initialDate ?? new Date();
  return {
    title: "",
    scheduledDate: format(d, "yyyy-MM-dd"),
    scheduledTime: "08:00",
    durationHours: "",
    modelId: "",
    assignedTo: "",
    description: "",
    status: "scheduled",
  };
}

function combineDateTime(dateStr: string, timeStr: string): string {
  // Build local-time ISO so the date the user picked is preserved.
  const local = new Date(`${dateStr}T${timeStr || "00:00"}`);
  return local.toISOString();
}

function eventStatusColor(status: string): string {
  if (status === "completed") return "text-[hsl(var(--status-available))]";
  if (status === "overdue") return "text-destructive";
  return "text-[#38bdf8]";
}

const SAFE_FILENAME_RE = /^[\w.\- ]+$/;

export default function Maintenance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: events = [], isLoading: eventsLoading } =
    useListMaintenanceEvents();
  const { data: pms = [], isLoading: pmsLoading } = useListPmDocuments();
  const { data: models = [] } = useListModels();

  const createEvent = useCreateMaintenanceEvent();
  const updateEvent = useUpdateMaintenanceEvent();
  const deleteEvent = useDeleteMaintenanceEvent();
  const createPm = useCreatePmDocument();
  const deletePm = useDeletePmDocument();
  const requestUploadUrl = useRequestUploadUrl();

  const [cursor, setCursor] = useState(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft());

  const [pmDialogOpen, setPmDialogOpen] = useState(false);
  const [pmTitle, setPmTitle] = useState("");
  const [pmModelId, setPmModelId] = useState("");
  const [pmPartCode, setPmPartCode] = useState("");
  const [pmNotes, setPmNotes] = useState("");
  const [pmFile, setPmFile] = useState<File | null>(null);
  const [pmUploading, setPmUploading] = useState(false);
  const pmFileInputRef = useRef<HTMLInputElement | null>(null);

  // Build the calendar grid (Sunday-aligned weeks) for the cursor month.
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, MaintenanceEvent[]>();
    for (const e of events) {
      const key = format(parseISO(e.scheduledFor as unknown as string), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    return [...events]
      .filter((e) => {
        const d = parseISO(e.scheduledFor as unknown as string);
        return !isBefore(d, today);
      })
      .sort((a, b) => {
        const da = parseISO(a.scheduledFor as unknown as string).getTime();
        const db = parseISO(b.scheduledFor as unknown as string).getTime();
        return da - db;
      })
      .slice(0, 8);
  }, [events]);

  const modelMap = useMemo(() => {
    const m = new Map<number, Model>();
    for (const x of models) m.set(x.id, x);
    return m;
  }, [models]);

  const openNewEventDialog = (date?: Date) => {
    setEditingId(null);
    setDraft(emptyDraft(date));
    setDialogOpen(true);
  };

  const openEditDialog = (e: MaintenanceEvent) => {
    const d = parseISO(e.scheduledFor as unknown as string);
    setEditingId(e.id);
    setDraft({
      title: e.title,
      scheduledDate: format(d, "yyyy-MM-dd"),
      scheduledTime: format(d, "HH:mm"),
      durationHours: e.durationHours != null ? String(e.durationHours) : "",
      modelId: e.modelId != null ? String(e.modelId) : "",
      assignedTo: e.assignedTo ?? "",
      description: e.description ?? "",
      status: e.status as EventStatus,
    });
    setDialogOpen(true);
  };

  const submitDraft = async () => {
    if (!draft.title.trim()) {
      toast({
        title: "Title required",
        description: "Give this maintenance task a name.",
        variant: "destructive",
      });
      return;
    }
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      scheduledFor: combineDateTime(draft.scheduledDate, draft.scheduledTime),
      durationHours: draft.durationHours
        ? Number(draft.durationHours)
        : null,
      modelId: draft.modelId ? Number(draft.modelId) : null,
      assignedTo: draft.assignedTo.trim() || null,
      status: draft.status,
    };
    try {
      if (editingId != null) {
        await updateEvent.mutateAsync({
          eventId: editingId,
          data: payload,
        });
        toast({ title: "Maintenance updated" });
      } else {
        await createEvent.mutateAsync({ data: payload });
        toast({ title: "Maintenance scheduled" });
      }
      queryClient.invalidateQueries({ queryKey: getListMaintenanceEventsQueryKey() });
      setDialogOpen(false);
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const removeEvent = async (id: number) => {
    if (!window.confirm("Delete this scheduled maintenance?")) return;
    try {
      await deleteEvent.mutateAsync({ eventId: id });
      queryClient.invalidateQueries({ queryKey: getListMaintenanceEventsQueryKey() });
      toast({ title: "Deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const resetPmDialog = () => {
    setPmTitle("");
    setPmModelId("");
    setPmPartCode("");
    setPmNotes("");
    setPmFile(null);
    if (pmFileInputRef.current) pmFileInputRef.current.value = "";
  };

  const handlePmFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!SAFE_FILENAME_RE.test(f.name)) {
      toast({
        title: "Invalid filename",
        description:
          "Use letters, numbers, dot, dash, underscore, and spaces only.",
        variant: "destructive",
      });
      return;
    }
    setPmFile(f);
    if (!pmTitle) setPmTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const submitPm = async () => {
    if (!pmFile) {
      toast({
        title: "Choose a file",
        description: "Select the PM document to upload.",
        variant: "destructive",
      });
      return;
    }
    if (!pmTitle.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    try {
      setPmUploading(true);
      const ct = pmFile.type || "application/octet-stream";
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: {
          name: pmFile.name,
          size: pmFile.size,
          contentType: ct,
        },
      });
      const res = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": ct },
        body: pmFile,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      await createPm.mutateAsync({
        data: {
          title: pmTitle.trim(),
          modelId: pmModelId ? Number(pmModelId) : null,
          partCode: pmPartCode.trim() || null,
          objectPath,
          fileName: pmFile.name,
          fileSize: pmFile.size,
          contentType: ct,
          notes: pmNotes.trim() || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListPmDocumentsQueryKey() });
      toast({ title: "PM uploaded" });
      setPmDialogOpen(false);
      resetPmDialog();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setPmUploading(false);
    }
  };

  const removePm = async (id: number) => {
    if (!window.confirm("Delete this PM document?")) return;
    try {
      await deletePm.mutateAsync({ pmId: id });
      queryClient.invalidateQueries({ queryKey: getListPmDocumentsQueryKey() });
      toast({ title: "Deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const isToday = (d: Date) => isSameDay(d, new Date());
  const today = startOfDay(new Date());

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-mono text-primary tracking-widest font-bold">
              MAINTENANCE
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              Schedule preventive maintenance and store PM documents
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => openNewEventDialog()}
              className="rounded-none font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-schedule-maintenance"
            >
              <Plus className="h-4 w-4 mr-2" />
              SCHEDULE MAINTENANCE
            </Button>
            <Button
              onClick={() => setPmDialogOpen(true)}
              variant="outline"
              className="rounded-none font-mono text-xs border-border"
              data-testid="button-upload-pm"
            >
              <Upload className="h-4 w-4 mr-2" />
              UPLOAD PM
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Calendar */}
          <Card className="rounded-none border-border bg-sidebar border-t-2 border-t-primary">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
                <div className="flex items-center gap-3">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-mono tracking-widest font-bold">
                    {format(cursor, "MMMM yyyy").toUpperCase()}
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCursor((c) => subMonths(c, 1))}
                    data-testid="button-prev-month"
                    title="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-none font-mono text-[10px] tracking-widest border-border px-2"
                    onClick={() => setCursor(new Date())}
                    data-testid="button-today"
                  >
                    TODAY
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCursor((c) => addMonths(c, 1))}
                    data-testid="button-next-month"
                    title="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b border-border bg-card/40">
                {WEEKDAY_LABELS.map((d) => (
                  <div
                    key={d}
                    className="px-2 py-2 text-[10px] font-mono tracking-widest text-muted-foreground text-center"
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day) => {
                  const inMonth = isSameMonth(day, cursor);
                  const dayKey = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDay.get(dayKey) ?? [];
                  return (
                    <div
                      key={dayKey}
                      role="gridcell"
                      tabIndex={0}
                      onClick={(ev) => {
                        if (ev.target === ev.currentTarget) openNewEventDialog(day);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.target === ev.currentTarget && (ev.key === "Enter" || ev.key === " ")) {
                          ev.preventDefault();
                          openNewEventDialog(day);
                        }
                      }}
                      className={`group relative text-left min-h-[88px] p-1.5 border-r border-b border-border last:border-r-0 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary focus:ring-inset ${
                        inMonth
                          ? "bg-background hover:bg-card"
                          : "bg-sidebar/40 text-muted-foreground/60 hover:bg-card/40"
                      }`}
                      data-testid={`day-cell-${dayKey}`}
                    >
                      <div className="flex items-center justify-between mb-1 pointer-events-none">
                        <span
                          className={`font-mono text-[11px] ${
                            isToday(day)
                              ? "text-primary font-bold"
                              : inMonth
                              ? "text-foreground"
                              : ""
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                        {isToday(day) && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((e) => {
                          const overdue =
                            e.status === "scheduled" &&
                            isBefore(
                              parseISO(e.scheduledFor as unknown as string),
                              today,
                            );
                          return (
                            <button
                              type="button"
                              key={e.id}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                openEditDialog(e);
                              }}
                              className={`block w-full text-left truncate font-mono text-[10px] px-1 py-0.5 border-l-2 rounded-none focus:outline-none focus:ring-1 focus:ring-primary ${
                                e.status === "completed"
                                  ? "border-l-[hsl(var(--status-available))] bg-[hsl(var(--status-available))]/10"
                                  : overdue
                                  ? "border-l-destructive bg-destructive/10"
                                  : "border-l-primary bg-primary/10"
                              } hover:brightness-125`}
                              title={`${format(
                                parseISO(e.scheduledFor as unknown as string),
                                "p",
                              )} — ${e.title}`}
                              data-testid={`event-chip-${e.id}`}
                            >
                              {e.title}
                            </button>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="font-mono text-[9px] text-muted-foreground px-1 pointer-events-none">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming sidebar */}
          <Card className="rounded-none border-border bg-sidebar border-t-2 border-t-accent">
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-mono tracking-widest font-bold">
                  UPCOMING
                </h2>
              </div>
              <div className="p-3 space-y-2 max-h-[560px] overflow-y-auto">
                {eventsLoading && (
                  <div className="text-center py-6 text-muted-foreground font-mono text-xs">
                    LOADING...
                  </div>
                )}
                {!eventsLoading && upcomingEvents.length === 0 && (
                  <div className="text-center py-8 border border-dashed border-border text-muted-foreground font-mono text-xs">
                    NO UPCOMING MAINTENANCE
                  </div>
                )}
                {upcomingEvents.map((e) => {
                  const d = parseISO(e.scheduledFor as unknown as string);
                  const overdue =
                    e.status === "scheduled" && isBefore(d, today);
                  const model = e.modelId != null ? modelMap.get(e.modelId) : null;
                  return (
                    <div
                      key={e.id}
                      onClick={() => openEditDialog(e)}
                      className="border border-border bg-card p-3 cursor-pointer hover:border-muted-foreground/40 transition-colors"
                      data-testid={`upcoming-event-${e.id}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-foreground truncate">
                          {e.title}
                        </span>
                        <span
                          className={`font-mono text-[9px] tracking-widest shrink-0 ${
                            overdue
                              ? "text-destructive"
                              : eventStatusColor(e.status)
                          }`}
                        >
                          {overdue ? "OVERDUE" : e.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {format(d, "EEE MMM d, yyyy · p")}
                      </div>
                      {model && (
                        <div className="font-mono text-[10px] text-[#38bdf8] mt-1 truncate">
                          {model.name}
                        </div>
                      )}
                      {e.assignedTo && (
                        <div className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">
                          → {e.assignedTo}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PM Documents */}
        <Card className="rounded-none border-border bg-sidebar border-t-2 border-t-primary">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-mono tracking-widest font-bold">
                PM DOCUMENTS
              </h2>
              <span className="text-[10px] font-mono text-muted-foreground tracking-widest ml-2">
                ({pms.length})
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 pl-6">
                    TITLE
                  </TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10">
                    MODEL
                  </TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10">
                    PART
                  </TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10">
                    FILE
                  </TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right">
                    UPLOADED
                  </TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right pr-6">
                    ACTIONS
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pmsLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center font-mono text-xs text-muted-foreground py-12 border-none"
                    >
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                )}
                {!pmsLoading && pms.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center font-mono text-xs text-muted-foreground py-12 border-none"
                    >
                      NO PM DOCUMENTS UPLOADED. CLICK UPLOAD PM TO BEGIN.
                    </TableCell>
                  </TableRow>
                )}
                {pms.map((p: PmDocument) => {
                  const m = p.modelId != null ? modelMap.get(p.modelId) : null;
                  return (
                    <TableRow
                      key={p.id}
                      className="border-border hover:bg-muted/50"
                      data-testid={`row-pm-${p.id}`}
                    >
                      <TableCell className="font-mono text-xs pl-6 text-foreground font-bold">
                        {p.title}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {m?.name ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#38bdf8]">
                        {p.partCode ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {p.fileName ?? "—"}
                        {p.fileSize ? (
                          <span className="ml-2 text-[10px]">
                            {(p.fileSize / 1024).toFixed(1)} KB
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right text-muted-foreground">
                        {format(
                          parseISO(p.uploadedAt as unknown as string),
                          "MMM d, yyyy",
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6 space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-none font-mono text-[10px] border-border"
                          asChild
                        >
                          <a
                            href={`/api/storage${p.objectPath}`}
                            download
                            target="_blank"
                            rel="noreferrer"
                            data-testid={`button-download-pm-${p.id}`}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            OPEN
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removePm(p.id)}
                          data-testid={`button-delete-pm-${p.id}`}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Schedule / edit event dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingId(null);
        }}
      >
        <DialogContent className="sm:max-w-[520px] border-border bg-card rounded-none">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary tracking-widest">
              {editingId != null ? "EDIT MAINTENANCE" : "SCHEDULE MAINTENANCE"}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              Add a preventive maintenance task to the calendar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                TITLE
              </Label>
              <Input
                className="rounded-none font-mono text-xs bg-input border-border mt-1"
                value={draft.title}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, title: e.target.value }))
                }
                placeholder="e.g. Replace hydraulic filter"
                data-testid="input-event-title"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  DATE
                </Label>
                <Input
                  type="date"
                  className="rounded-none font-mono text-xs bg-input border-border mt-1"
                  value={draft.scheduledDate}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, scheduledDate: e.target.value }))
                  }
                  data-testid="input-event-date"
                />
              </div>
              <div>
                <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  TIME
                </Label>
                <Input
                  type="time"
                  className="rounded-none font-mono text-xs bg-input border-border mt-1"
                  value={draft.scheduledTime}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, scheduledTime: e.target.value }))
                  }
                  data-testid="input-event-time"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  DURATION (HOURS)
                </Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  className="rounded-none font-mono text-xs bg-input border-border mt-1"
                  value={draft.durationHours}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, durationHours: e.target.value }))
                  }
                  placeholder="e.g. 2"
                  data-testid="input-event-duration"
                />
              </div>
              <div>
                <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  STATUS
                </Label>
                <Select
                  value={draft.status}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, status: v as EventStatus }))
                  }
                >
                  <SelectTrigger
                    className="rounded-none font-mono text-xs bg-input border-border mt-1"
                    data-testid="select-event-status"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="scheduled">SCHEDULED</SelectItem>
                    <SelectItem value="completed">COMPLETED</SelectItem>
                    <SelectItem value="overdue">OVERDUE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                MODEL (OPTIONAL)
              </Label>
              <Select
                value={draft.modelId || "none"}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, modelId: v === "none" ? "" : v }))
                }
              >
                <SelectTrigger
                  className="rounded-none font-mono text-xs bg-input border-border mt-1"
                  data-testid="select-event-model"
                >
                  <SelectValue placeholder="No model" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="none">— NONE —</SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                ASSIGNED TO
              </Label>
              <Input
                className="rounded-none font-mono text-xs bg-input border-border mt-1"
                value={draft.assignedTo}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, assignedTo: e.target.value }))
                }
                placeholder="e.g. Field Tech A"
                data-testid="input-event-assignee"
              />
            </div>

            <div>
              <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                NOTES
              </Label>
              <Textarea
                className="rounded-none font-mono text-xs bg-input border-border mt-1 resize-none"
                rows={3}
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                data-testid="input-event-description"
              />
            </div>
          </div>

          <DialogFooter className="mt-2 flex justify-between sm:justify-between">
            {editingId != null ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-none font-mono text-xs border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => {
                  void removeEvent(editingId);
                  setDialogOpen(false);
                }}
                data-testid="button-delete-event"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                DELETE
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-none font-mono text-xs border-border"
                onClick={() => setDialogOpen(false)}
              >
                CANCEL
              </Button>
              <Button
                type="button"
                onClick={submitDraft}
                disabled={createEvent.isPending || updateEvent.isPending}
                className="rounded-none font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-save-event"
              >
                {(createEvent.isPending || updateEvent.isPending) && (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                )}
                {editingId != null ? "SAVE CHANGES" : "SCHEDULE"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload PM dialog */}
      <Dialog
        open={pmDialogOpen}
        onOpenChange={(o) => {
          setPmDialogOpen(o);
          if (!o) resetPmDialog();
        }}
      >
        <DialogContent className="sm:max-w-[520px] border-border bg-card rounded-none">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary tracking-widest">
              UPLOAD PM
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              Upload a Preventive Maintenance document (PDF, image, or any
              other reference file).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-border p-6 flex flex-col items-center text-center">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="font-mono text-xs text-foreground mb-2">
                {pmFile ? pmFile.name : "SELECT FILE"}
              </p>
              {pmFile && (
                <p className="font-mono text-[10px] text-muted-foreground mb-2">
                  {(pmFile.size / 1024).toFixed(1)} KB
                </p>
              )}
              <input
                ref={pmFileInputRef}
                type="file"
                className="hidden"
                onChange={handlePmFileChange}
                data-testid="input-pm-file"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-none font-mono text-xs border-border"
                onClick={() => pmFileInputRef.current?.click()}
              >
                {pmFile ? "CHANGE FILE" : "CHOOSE FILE"}
              </Button>
            </div>

            <div>
              <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                TITLE
              </Label>
              <Input
                className="rounded-none font-mono text-xs bg-input border-border mt-1"
                value={pmTitle}
                onChange={(e) => setPmTitle(e.target.value)}
                placeholder="e.g. Hydraulic Hose 1000hr PM"
                data-testid="input-pm-title"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  MODEL (OPTIONAL)
                </Label>
                <Select
                  value={pmModelId || "none"}
                  onValueChange={(v) =>
                    setPmModelId(v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger
                    className="rounded-none font-mono text-xs bg-input border-border mt-1"
                    data-testid="select-pm-model"
                  >
                    <SelectValue placeholder="No model" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="none">— NONE —</SelectItem>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  PART CODE (OPTIONAL)
                </Label>
                <Input
                  className="rounded-none font-mono text-xs bg-input border-border mt-1"
                  value={pmPartCode}
                  onChange={(e) => setPmPartCode(e.target.value)}
                  placeholder="e.g. CYL-01"
                  data-testid="input-pm-partcode"
                />
              </div>
            </div>

            <div>
              <Label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                NOTES
              </Label>
              <Textarea
                className="rounded-none font-mono text-xs bg-input border-border mt-1 resize-none"
                rows={2}
                value={pmNotes}
                onChange={(e) => setPmNotes(e.target.value)}
                data-testid="input-pm-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-none font-mono text-xs border-border"
              onClick={() => setPmDialogOpen(false)}
              disabled={pmUploading}
            >
              CANCEL
            </Button>
            <Button
              type="button"
              onClick={submitPm}
              disabled={pmUploading || !pmFile}
              className="rounded-none font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-save-pm"
            >
              {pmUploading && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              UPLOAD
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

