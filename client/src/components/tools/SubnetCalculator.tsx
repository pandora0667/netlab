import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { subnetCalculatorSchema } from "@/domains/network/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Download, HelpCircle, RefreshCw, GitMerge, Network, AlertCircle } from "lucide-react";
import {
  calculateSubnetInfo,
  divideSubnet,
  areAdjacent,
  exportToCSV,
  netmaskToCidr,
} from "@/domains/network/subnet";
import { SEO } from "../SEO";
import { ToolPageShell } from "@/components/layout/ToolPageShell";

const columns = [
  { id: "networkAddress", label: "Network Address", tooltip: "The base address of the subnet" },
  { id: "broadcastAddress", label: "Broadcast", tooltip: "The broadcast address of the subnet" },
  { id: "firstUsableIP", label: "First Usable", tooltip: "First usable IP in the subnet" },
  { id: "lastUsableIP", label: "Last Usable", tooltip: "Last usable IP in the subnet" },
  { id: "numHosts", label: "Number of Hosts", tooltip: "Total number of usable host addresses" },
  { id: "subnetMask", label: "Subnet Mask", tooltip: "The subnet mask in CIDR and decimal notation" },
];

export default function SubnetCalculator() {
  const [subnets, setSubnets] = useState<ReturnType<typeof calculateSubnetInfo>[]>([]);
  const [selectedSubnets, setSelectedSubnets] = useState<number[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns.map(col => col.id));
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(subnetCalculatorSchema),
    defaultValues: {
      networkAddress: "",
      mask: ""
    }
  });

  const sortedSubnets = useMemo(() => {
    if (!sortConfig) return subnets;

    return [...subnets].sort((a: any, b: any) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [subnets, sortConfig]);

  const canMergeSubnets = useMemo(() => {
    if (selectedSubnets.length !== 2) return false;
    const [index1, index2] = selectedSubnets.sort();
    const subnet1 = subnets[index1];
    const subnet2 = subnets[index2];
    return subnet1 && subnet2 && areAdjacent(subnet1, subnet2);
  }, [selectedSubnets, subnets]);

  const getMergeTooltip = () => {
    if (selectedSubnets.length === 0) return "Select two subnets to merge";
    if (selectedSubnets.length === 1) return "Select one more subnet to merge";
    if (!canMergeSubnets) return "Selected subnets must be adjacent to merge";
    return "Merge selected subnets";
  };

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const handleColumnToggle = (columnId: string) => {
    setVisibleColumns(current =>
      current.includes(columnId)
        ? current.filter(id => id !== columnId)
        : [...current, columnId]
    );
  };

  const handleDivide = (subnetIndex: number) => {
    const subnet = subnets[subnetIndex];
    if (!subnet) return;

    try {
      const newSubnets = divideSubnet(
        subnet.networkAddress,
        subnet.subnetMask,
        subnet.subnetMask + 1
      );

      setSubnets(current => [
        ...current.slice(0, subnetIndex),
        ...newSubnets,
        ...current.slice(subnetIndex + 1)
      ]);
    } catch (error) {
      console.error('Failed to divide subnet:', error);
    }
  };

  const handleJoin = () => {
    if (!canMergeSubnets) return;

    const [index1, index2] = selectedSubnets.sort();
    const subnet1 = subnets[index1];
    const subnet2 = subnets[index2];

    if (!subnet1 || !subnet2) return;

    const joinedSubnet = calculateSubnetInfo(
      subnet1.networkAddress,
      subnet1.subnetMask - 1
    );

    setSubnets(current => [
      ...current.slice(0, index1),
      joinedSubnet,
      ...current.slice(index2 + 1)
    ]);
    setSelectedSubnets([]);
  };

  const handleExport = () => {
    const csvHeaders = visibleColumns
      .map((columnId) => columns.find((column) => column.id === columnId)?.label)
      .filter((label): label is string => Boolean(label))
      .join(",");
    const csvData = exportToCSV(sortedSubnets, visibleColumns);
    const csv = `${csvHeaders}\n${csvData}`;
  
    // Create and trigger download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    a.href = url;
    a.download = `subnet_calculation_${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    form.reset();
    setSubnets([]);
    setSelectedSubnets([]);
    setSortConfig(null);
  };

  async function onSubmit(data: { networkAddress: string; mask: string }) {
    setIsLoading(true);
    try {
      const maskBits = data.mask.startsWith('/')
        ? parseInt(data.mask.slice(1))
        : netmaskToCidr(data.mask);

      const result = calculateSubnetInfo(data.networkAddress, maskBits);
      setSubnets([result]);
      setSelectedSubnets([]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const activeWorkspaceTokens = [
    sortConfig ? `Sort: ${sortConfig.key} ${sortConfig.direction}` : "Sort: none",
    `Columns: ${visibleColumns.length}`,
    selectedSubnets.length > 0 ? `Selected: ${selectedSubnets.length}` : null,
    `Rows: ${sortedSubnets.length}`,
  ].filter(Boolean) as string[];

  return (
    <>
      <SEO page="subnetCalculator" />
      <ToolPageShell
        title="Subnet Calculator"
        description="Calculate ranges, host counts, and subnet splits from a network address and CIDR or subnet mask."
      >
      <div className="space-y-4">
        <div className="tool-surface space-y-6">
          <div className="space-y-3">
            <span className="tool-kicker">
              <Network className="h-3.5 w-3.5" />
              Address math
            </span>
            <div className="space-y-2">
              <p className="tool-heading">Calculate subnet boundaries, usable ranges, and host counts with fewer clicks.</p>
              <p className="tool-copy">
                Start with a network address and mask. Then sort, hide columns, split networks,
                or merge adjacent ranges directly from the result workspace.
              </p>
            </div>
          </div>

        <Card className="border-white/8 bg-white/[0.02] p-4 sm:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="networkAddress"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Network Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            placeholder="192.168.1.0" 
                            {...field}
                            className={fieldState.error ? "border-destructive" : ""} 
                          />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {fieldState.error ? (
                                  <AlertCircle className="h-4 w-4 absolute right-3 top-3 text-destructive" />
                                ) : (
                                  <HelpCircle className="h-4 w-4 absolute right-3 top-3 text-muted-foreground" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {fieldState.error
                                    ? fieldState.error.message
                                    : "Enter a valid IPv4 address (e.g., 192.168.1.0)"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Example: 192.168.1.0, 10.0.0.0, 172.16.0.0
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mask"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Subnet Mask</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            placeholder="/24 or 255.255.255.0" 
                            {...field}
                            className={fieldState.error ? "border-destructive" : ""} 
                          />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {fieldState.error ? (
                                  <AlertCircle className="h-4 w-4 absolute right-3 top-3 text-destructive" />
                                ) : (
                                  <HelpCircle className="h-4 w-4 absolute right-3 top-3 text-muted-foreground" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {fieldState.error
                                    ? fieldState.error.message
                                    : "Enter CIDR notation (e.g., /24) or netmask (e.g., 255.255.255.0)"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        CIDR: /8 to /32 or Netmask: 255.0.0.0 to 255.255.255.255
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex space-x-2">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    'Calculate'
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </form>
          </Form>
        </Card>
        </div>

        {subnets.length > 0 && (
          <div className="tool-surface space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="tool-metric">
                <p className="tool-metric-label">Visible subnets</p>
                <p className="tool-metric-value">{sortedSubnets.length}</p>
              </div>
              <div className="tool-metric">
                <p className="tool-metric-label">Selected</p>
                <p className="tool-metric-value">{selectedSubnets.length}</p>
              </div>
              <div className="tool-metric">
                <p className="tool-metric-label">Columns</p>
                <p className="tool-metric-value">{visibleColumns.length}</p>
              </div>
              <div className="tool-metric">
                <p className="tool-metric-label">Sort</p>
                <p className="tool-metric-value text-[1.1rem]">
                  {sortConfig ? `${sortConfig.direction}` : "None"}
                </p>
              </div>
            </div>

            <div className="tool-inline-guidance text-sm text-white/66">
              <div className="tool-surface-muted">
                Keep all columns visible on the first pass, then hide fields only when you are exporting or comparing ranges.
              </div>
              <div className="tool-surface-muted">
                Split from the row action when you need finer ranges, and merge only when two adjacent networks are selected.
              </div>
              <div className="tool-surface-muted">
                Keep column controls next to the table. That reduces eye travel when you are iterating through multiple subnet views.
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Columns
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {columns.map(column => (
                      <DropdownMenuItem
                        key={column.id}
                        className="flex items-center space-x-2"
                        onSelect={(e) => {
                          e.preventDefault();
                          handleColumnToggle(column.id);
                        }}
                      >
                        <Checkbox
                          checked={visibleColumns.includes(column.id)}
                          onCheckedChange={() => handleColumnToggle(column.id)}
                        />
                        <span>{column.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="flex items-center"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>

              {selectedSubnets.length === 2 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleJoin}
                          disabled={!canMergeSubnets}
                          className={`flex items-center ${!canMergeSubnets ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <GitMerge className="h-4 w-4" />
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{getMergeTooltip()}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {activeWorkspaceTokens.map((token) => (
                <span
                  key={token}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.72rem] font-mono uppercase tracking-[0.16em] text-white/58"
                >
                  {token}
                </span>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.filter(col => visibleColumns.includes(col.id)).map(column => (
                      <TableHead
                        key={column.id}
                        className="sticky top-0 cursor-pointer bg-[rgb(14_17_27_/_0.96)] backdrop-blur hover:bg-muted/50"
                        onClick={() => handleSort(column.id)}
                      >
                        <div className="flex items-center space-x-2">
                          <span>{column.label}</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{column.tooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="sticky top-0 w-[100px] bg-[rgb(14_17_27_/_0.96)] backdrop-blur">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSubnets.map((subnet, index) => (
                    <TableRow
                      key={subnet.networkAddress}
                      className="group"
                    >
                      {columns
                        .filter(col => visibleColumns.includes(col.id))
                        .map(column => (
                          <TableCell key={column.id}>
                            {column.id === 'subnetMask'
                              ? `${subnet.netmask} (/${subnet.subnetMask})`
                              : subnet[column.id as keyof typeof subnet]}
                          </TableCell>
                        ))}
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDivide(index)}
                                >
                                  <Network className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Divide this subnet into smaller subnets</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Checkbox
                            checked={selectedSubnets.includes(index)}
                            onCheckedChange={(checked) => {
                              setSelectedSubnets(current => {
                                if (checked) {
                                  if (current.length >= 2) return current;
                                  return [...current, index];
                                }
                                return current.filter(i => i !== index);
                              });
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
      </ToolPageShell>
    </>
  );
}
