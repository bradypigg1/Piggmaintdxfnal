import { useGetInventoryStats, useGetInventoryByModel, useGetComponentsByStatus, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Box, Package, AlertTriangle, XOctagon, Clock, Wrench } from "lucide-react";
import { StatusBadge } from "./workspace";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats } = useGetInventoryStats();
  const { data: modelInventory = [] } = useGetInventoryByModel();
  const { data: statusCounts = [] } = useGetComponentsByStatus();
  const { data: recentActivity = [] } = useGetRecentActivity();

  const statusData = statusCounts.map(s => ({
    name: s.status.toUpperCase(),
    value: s.count,
    color: s.status === 'available' ? 'hsl(var(--status-available))' : s.status === 'low' ? 'hsl(var(--status-low))' : 'hsl(var(--destructive))'
  }));

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-mono text-primary tracking-widest font-bold">SYSTEM OVERVIEW</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">Live metrics and inventory status</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-none border-border bg-sidebar">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-mono text-muted-foreground tracking-widest">TOTAL MODELS</p>
                  <p className="text-3xl font-mono font-bold text-foreground">{stats?.totalModels || 0}</p>
                </div>
                <div className="p-2 bg-primary/10">
                  <Box className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-none border-border bg-sidebar">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-mono text-muted-foreground tracking-widest">TOTAL PARTS</p>
                  <p className="text-3xl font-mono font-bold text-foreground">{stats?.totalComponents || 0}</p>
                </div>
                <div className="p-2 bg-accent/10">
                  <Wrench className="w-5 h-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border bg-sidebar border-t-2 border-t-[hsl(var(--status-low))]">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-mono text-muted-foreground tracking-widest">LOW STOCK</p>
                  <p className="text-3xl font-mono font-bold text-[hsl(var(--status-low))]">{stats?.lowStockCount || 0}</p>
                </div>
                <div className="p-2 bg-[hsl(var(--status-low))]/10">
                  <AlertTriangle className="w-5 h-5 text-[hsl(var(--status-low))]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border bg-sidebar border-t-2 border-t-destructive">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-mono text-muted-foreground tracking-widest">OUT OF STOCK</p>
                  <p className="text-3xl font-mono font-bold text-destructive">{stats?.outOfStockCount || 0}</p>
                </div>
                <div className="p-2 bg-destructive/10">
                  <XOctagon className="w-5 h-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="rounded-none border-border bg-sidebar col-span-1 lg:col-span-2">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xs font-mono tracking-widest text-primary">INVENTORY BY MODEL</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono text-[10px] text-muted-foreground h-10 pl-4">MODEL</TableHead>
                    <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right">PARTS</TableHead>
                    <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right">ON HAND</TableHead>
                    <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right pr-4">AVAILABLE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelInventory.map(row => (
                    <TableRow key={row.modelId} className="border-border hover:bg-muted/50">
                      <TableCell className="font-mono text-xs pl-4">{row.modelName}</TableCell>
                      <TableCell className="font-mono text-xs text-right text-muted-foreground">{row.componentCount}</TableCell>
                      <TableCell className="font-mono text-xs text-right text-muted-foreground">{row.onHand}</TableCell>
                      <TableCell className="font-mono text-xs text-right pr-4 font-bold">{row.available}</TableCell>
                    </TableRow>
                  ))}
                  {modelInventory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center font-mono text-xs text-muted-foreground py-8">
                        No models configured
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-none border-border bg-sidebar">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-xs font-mono tracking-widest text-primary">STATUS DISTRIBUTION</CardTitle>
              </CardHeader>
              <CardContent className="p-6 h-[220px]">
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888', fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#888', fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: 0, fontFamily: 'monospace', fontSize: '12px' }}
                      />
                      <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-xs font-mono">No data available</div>
                )}
              </CardContent>
            </Card>
            
            <Card className="rounded-none border-border bg-sidebar">
              <CardHeader className="border-b border-border pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-mono tracking-widest text-primary">RECENT ACTIVITY</CardTitle>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} className="p-4 flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-accent font-bold">{activity.code}</span>
                          <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">{activity.modelName}</span>
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground truncate w-[200px]">{activity.description}</p>
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground text-right whitespace-nowrap">
                        {format(new Date(activity.updatedAt), "MMM d, HH:mm")}
                      </div>
                    </div>
                  ))}
                  {recentActivity.length === 0 && (
                    <div className="p-8 text-center text-xs font-mono text-muted-foreground">
                      No recent activity
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
