import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search, Building2, FolderOpen, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import type { ActivityWithPhase, ConstructionPhase } from "@shared/schema";

interface ActivitySelectorProps {
  onActivitySelect?: (activity: ActivityWithPhase) => void;
  selectedActivityId?: number;
  placeholder?: string;
  className?: string;
  showPhaseFilter?: boolean;
}

export function ActivitySelector({
  onActivitySelect,
  selectedActivityId,
  placeholder = "Seleccionar actividad...",
  className,
  showPhaseFilter = true
}: ActivitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("all");

  const { data: activities, isLoading } = useQuery<ActivityWithPhase[]>({
    queryKey: ["/api/activities", { withCompositions: true }],
    queryFn: async () => {
      const response = await fetch("/api/activities?withCompositions=true");
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    },
  });

  const { data: phases } = useQuery<ConstructionPhase[]>({
    queryKey: ["/api/construction-phases"],
    queryFn: async () => {
      const response = await fetch("/api/construction-phases");
      if (!response.ok) throw new Error('Failed to fetch phases');
      return response.json();
    },
  });

  const selectedActivity = activities?.find(activity => activity.id === selectedActivityId);

  const filteredActivities = activities?.filter(activity => {
    const matchesSearch = activity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.phase.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPhase = selectedPhaseId === "all" || activity.phaseId.toString() === selectedPhaseId;
    
    return matchesSearch && matchesPhase;
  });

  const groupedActivities = filteredActivities?.reduce((acc, activity) => {
    const phaseName = activity.phase.name;
    if (!acc[phaseName]) {
      acc[phaseName] = [];
    }
    acc[phaseName].push(activity);
    return acc;
  }, {} as Record<string, ActivityWithPhase[]>);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Filtro de Grupo/Fase */}
      {showPhaseFilter && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Grupo de Actividades:</label>
          <Select value={selectedPhaseId} onValueChange={setSelectedPhaseId}>
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-gray-500" />
                <SelectValue placeholder="Seleccionar grupo" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Todas las Actividades
                </div>
              </SelectItem>
              {phases?.map((phase) => (
                <SelectItem key={phase.id} value={phase.id.toString()}>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    {phase.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Indicador de filtro activo */}
      {selectedPhaseId !== "all" && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Grupo: {phases?.find(p => p.id.toString() === selectedPhaseId)?.name}
            <button 
              onClick={() => setSelectedPhaseId("all")}
              className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
            >
              ×
            </button>
          </Badge>
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedActivity ? (
              <div className="flex items-center gap-2 truncate">
                <Building2 className="h-4 w-4 text-gray-500" />
                <span className="truncate">{selectedActivity.name}</span>
                <Badge variant="secondary" className="ml-auto">
                  {selectedActivity.phase.name}
                </Badge>
              </div>
            ) : (
              <span className="text-gray-500">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full min-w-[400px] p-0" align="start">
          <Command>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                placeholder="Buscar actividades..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-0 focus:ring-0 focus:outline-none"
              />
            </div>
            <CommandList className="max-h-[300px]">
              <CommandEmpty>No se encontraron actividades.</CommandEmpty>
              
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                Object.entries(groupedActivities || {}).map(([phaseName, phaseActivities]) => (
                  <CommandGroup key={phaseName} heading={phaseName}>
                    {phaseActivities.map((activity) => (
                      <CommandItem
                        key={activity.id}
                        value={`${activity.name} ${activity.phase.name} ${activity.description || ''}`}
                        onSelect={() => {
                          onActivitySelect?.(activity);
                          setOpen(false);
                        }}
                        className="flex items-center justify-between p-2"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Check
                            className={cn(
                              "h-4 w-4",
                              selectedActivityId === activity.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{activity.name}</div>
                            {activity.description && (
                              <div className="text-sm text-gray-500 truncate">
                                {activity.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {activity.unitPrice && (
                            <Badge variant="outline" className="text-xs">
                              {formatCurrency(activity.unitPrice)}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {activity.unit}
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Activity Details Card */}
      {selectedActivity && (
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {selectedActivity.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Fase:</span>
                <Badge variant="secondary" className="ml-2">
                  {selectedActivity.phase.name}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Unidad:</span>
                <Badge variant="outline" className="ml-2">
                  {selectedActivity.unit}
                </Badge>
              </div>
            </div>
            
            {selectedActivity.unitPrice && (
              <div className="text-sm">
                <span className="font-medium">Precio Unitario:</span>
                <Badge variant="default" className="ml-2">
                  {formatCurrency(selectedActivity.unitPrice)}
                </Badge>
              </div>
            )}

            {selectedActivity.description && (
              <div className="text-sm">
                <span className="font-medium">Descripción:</span>
                <p className="text-gray-600 mt-1">{selectedActivity.description}</p>
              </div>
            )}

            {selectedActivity.compositions && selectedActivity.compositions.length > 0 && (
              <div className="text-sm">
                <span className="font-medium">Composición APU:</span>
                <div className="text-gray-600 mt-1">
                  {selectedActivity.compositions.length} insumo(s) registrado(s)
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ActivitySelector;