import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

type BlockType = 'foundation' | 'wall' | 'roof' | 'window' | 'door';

interface Block {
  id: number;
  type: BlockType;
  x: number;
  y: number;
}

export function ConstructorGameSimple() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<BlockType | null>(null);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const blockTypes: { type: BlockType; emoji: string; name: string }[] = [
    { type: 'foundation', emoji: '🧱', name: 'Cimiento' },
    { type: 'wall', emoji: '🏗️', name: 'Pared' },
    { type: 'roof', emoji: '🏠', name: 'Techo' },
    { type: 'window', emoji: '🪟', name: 'Ventana' },
    { type: 'door', emoji: '🚪', name: 'Puerta' },
  ];

  const resetGame = () => {
    setBlocks([]);
    setScore(0);
    setGameStarted(true);
    setSelectedBlock('foundation');
  };

  const handleCellClick = (x: number, y: number) => {
    if (!selectedBlock) return;
    
    // Verificar si la posición está ocupada
    const isOccupied = blocks.some(block => block.x === x && block.y === y);
    if (isOccupied) {
      // Remover bloque si ya existe
      setBlocks(blocks.filter(block => !(block.x === x && block.y === y)));
      setScore(Math.max(0, score - 5));
    } else {
      // Agregar nuevo bloque
      const newBlock: Block = {
        id: Date.now(),
        type: selectedBlock,
        x,
        y,
      };
      setBlocks([...blocks, newBlock]);
      setScore(score + 10);
    }
  };

  const getBlockEmoji = (type: BlockType) => {
    return blockTypes.find(b => b.type === type)?.emoji || '📦';
  };

  // Grid más alto que ancho para móviles
  const gridCols = isMobile ? 3 : 6;
  const gridRows = isMobile ? 6 : 4;
  const totalCells = gridCols * gridRows;

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader className="pb-3 sm:pb-6">
        <CardTitle className="text-center flex items-center justify-center gap-2 text-lg sm:text-xl">
          <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
          Constructor Virtual MICAA
        </CardTitle>
        <CardDescription className="text-center text-sm sm:text-base px-2 sm:px-0">
          {isMobile 
            ? '¡Tocá para construir! Seleccioná un bloque y tocá una celda.'
            : '¡Construye tu proyecto! Seleccioná un bloque y hacé clic en el área de construcción.'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
        {!gameStarted ? (
          <div className="text-center py-6 sm:py-8">
            <Button onClick={resetGame} size="lg" className="w-full sm:w-auto">
              🎮 Comenzar a Construir
            </Button>
          </div>
        ) : (
          <>
            {/* Score */}
            <div className="text-center">
              <Badge variant="secondary" className="text-base sm:text-lg px-3 sm:px-4 py-1 sm:py-2">
                🏆 Puntos: {score}
              </Badge>
            </div>

            {/* Selector de Bloques */}
            <div className="bg-gray-100 dark:bg-gray-800 p-3 sm:p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-semibold mb-2">
                Seleccioná el tipo de bloque:
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {blockTypes.map((blockType) => (
                  <button
                    key={blockType.type}
                    onClick={() => setSelectedBlock(blockType.type)}
                    className={`p-2 sm:p-3 rounded-lg transition-all duration-200 ${
                      selectedBlock === blockType.type
                        ? 'bg-primary text-white shadow-lg scale-105'
                        : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:border-primary/40 dark:hover:border-primary/40'
                    }`}
                  >
                    <div className="text-lg sm:text-2xl mb-1">{blockType.emoji}</div>
                    <div className="text-xs text-current">{blockType.name}</div>
                  </button>
                ))}
              </div>
              {selectedBlock && (
                <p className="text-xs sm:text-sm text-muted-foreground dark:text-gray-400 mt-2 text-center">
                  Bloque seleccionado: {getBlockEmoji(selectedBlock)} {blockTypes.find(b => b.type === selectedBlock)?.name}
                </p>
              )}
            </div>

            {/* Área de Construcción - Vertical en móvil */}
            <div className="bg-gradient-to-b from-sky-200 to-green-200 dark:from-sky-800 dark:to-green-800 rounded-lg p-3 sm:p-4 relative">
              <h3 className="text-xs sm:text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200 text-center">
                Área de Construcción - {isMobile ? 'Tocá' : 'Hacé clic'} en las celdas
              </h3>
              <div 
                className={`grid gap-1 mx-auto ${
                  isMobile 
                    ? 'grid-cols-3 max-w-[240px]' 
                    : 'grid-cols-6 max-w-[360px]'
                }`}
                style={{
                  aspectRatio: isMobile ? '3/6' : '6/4'
                }}
              >
                {Array.from({ length: totalCells }, (_, i) => {
                  const x = i % gridCols;
                  const y = Math.floor(i / gridCols);
                  const hasBlock = blocks.find(block => block.x === x && block.y === y);
                  
                  return (
                    <div
                      key={i}
                      className={`border-2 rounded-lg flex items-center justify-center text-base sm:text-lg transition-all duration-200 cursor-pointer ${
                        isMobile ? 'min-h-[60px]' : 'min-h-[50px]'
                      } ${
                        hasBlock
                          ? 'border-green-400 bg-white/90 dark:bg-gray-700/90 shadow-md'
                          : selectedBlock
                          ? 'border-primary/40 bg-primary/10/70 dark:bg-blue-900/30 hover:bg-primary/10 dark:hover:bg-primary/90/50'
                          : 'border-gray-300 bg-white/50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50'
                      }`}
                      onClick={() => handleCellClick(x, y)}
                    >
                      {hasBlock && (
                        <span className="drop-shadow-sm">
                          {getBlockEmoji(hasBlock.type)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <p className="text-xs text-muted-foreground dark:text-gray-300 mt-2 text-center">
                {isMobile 
                  ? 'Tocá una celda vacía para construir, tocá un bloque para remover'
                  : 'Hacé clic en una celda vacía para construir, clic en un bloque para remover'
                }
              </p>
            </div>

            {/* Controles */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-center">
              <Button onClick={resetGame} variant="outline" size="sm" className="w-full sm:w-auto">
                🔄 Nuevo Proyecto
              </Button>
              <Button 
                onClick={() => {
                  setBlocks([]);
                  setScore(Math.max(0, score - blocks.length * 5));
                }} 
                variant="outline" 
                size="sm"
                disabled={blocks.length === 0}
                className="w-full sm:w-auto"
              >
                🗑️ Limpiar Área
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  // Generar construcción aleatoria
                  const randomBlocks: Block[] = [];
                  const maxBlocks = Math.min(isMobile ? 8 : 12, totalCells);
                  const occupiedPositions = new Set();
                  
                  for (let i = 0; i < maxBlocks; i++) {
                    let x, y;
                    do {
                      x = Math.floor(Math.random() * gridCols);
                      y = Math.floor(Math.random() * gridRows);
                    } while (occupiedPositions.has(`${x}-${y}`));
                    
                    occupiedPositions.add(`${x}-${y}`);
                    randomBlocks.push({
                      id: Date.now() + i,
                      type: blockTypes[Math.floor(Math.random() * blockTypes.length)].type,
                      x,
                      y,
                    });
                  }
                  setBlocks(randomBlocks);
                  setScore(score + randomBlocks.length * 10);
                }}
              >
                🎲 Construcción Aleatoria
              </Button>
            </div>

            {/* Estadísticas */}
            {blocks.length > 0 && (
              <div className="bg-primary/10 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                <div className="text-xs sm:text-sm text-primary dark:text-blue-200">
                  <p className="font-medium">
                    ¡Genial! Has colocado {blocks.length} bloque{blocks.length !== 1 ? 's' : ''}
                  </p>
                  {blocks.length >= 8 && (
                    <p className="mt-1">🏆 ¡Eres todo un constructor profesional!</p>
                  )}
                  <div className="flex justify-center gap-4 mt-2 text-xs">
                    <span>🧱 {blocks.filter(b => b.type === 'foundation').length} Cimientos</span>
                    <span>🏗️ {blocks.filter(b => b.type === 'wall').length} Paredes</span>
                    <span>🏠 {blocks.filter(b => b.type === 'roof').length} Techos</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}