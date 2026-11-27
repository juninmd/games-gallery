/**
 * Console sheets for the Platforms page: real photo, short history and hardware.
 * Ported from iBox (MIT, https://github.com/atzski/ibox `platformCatalog.ts`) and
 * translated to pt-BR. Photo licences: `public/platforms/CREDITS.md`.
 */
export type ConsoleKind = "home" | "handheld" | "hybrid" | "arcade";

export interface ConsoleSheet {
  maker: string;
  kind: ConsoleKind;
  /** Cut-out photo served from `public/platforms`. */
  photo: string;
  history: string;
  /** Label, value. A value that could not be verified is left out. */
  specs: [string, string][];
}

const s = (maker: string, kind: ConsoleKind, id: string, history: string, specs: [string, string][]): [string, ConsoleSheet] =>
  [id, { maker, kind, photo: `/platforms/${id}.webp`, history, specs }];

const CART: [string, string] = ["Mídia", "Cartucho"];
const CARD: [string, string] = ["Mídia", "Cartão de jogo"];

export const CONSOLE_SHEETS: Record<string, ConsoleSheet> = Object.fromEntries([
  s("Nintendo", "home", "nes", "Nascido Famicom no Japão, reergueu o mercado americano depois de 1983 com um selo de qualidade e séries que viraram pilares: Mario, Zelda, Metroid.", [
    ["Processador", "Ricoh 2A03 (núcleo 6502), 1,79 MHz"], ["Gráficos", "Ricoh 2C02 (PPU)"], ["Memória", "2 KB + 2 KB de vídeo"], ["Resolução", "256 × 240"], CART,
  ]),
  s("Nintendo", "home", "snes", "O 16-bit da Nintendo girava cenários inteiros com o Mode 7 e levava chips extras nos cartuchos, como o Super FX de Star Fox.", [
    ["Processador", "Ricoh 5A22 (65C816), até 3,58 MHz"], ["Gráficos", "S-PPU1 e S-PPU2"], ["Memória", "128 KB + 64 KB de vídeo"], ["Resolução", "256 × 224 (até 512 × 448)"], CART, ["Destaque", "Mode 7, chips extras nos cartuchos"],
  ]),
  s("Nintendo", "home", "n64", "Popularizou o analógico e a vibração, e suas quatro portas de controle eram um convite permanente para jogar com os amigos.", [
    ["Processador", "NEC VR4300, 93,75 MHz"], ["Gráficos", "Reality Coprocessor (RCP), 62,5 MHz"], ["Memória", "4 MB RDRAM (8 MB com Expansion Pak)"], ["Resolução", "320 × 240 a 640 × 480"], CART,
  ]),
  s("Nintendo", "home", "gc", "Um cubo com alça, mini discos de 8 cm e um controle feito para as mãos: o GameCube trouxe Pikmin e, no Ocidente, Animal Crossing.", [
    ["Processador", "IBM PowerPC “Gekko”, 486 MHz"], ["Gráficos", "ATI “Flipper”, 162 MHz"], ["Memória", "24 MB 1T-SRAM + 16 MB A-RAM"], ["Resolução", "Até 640 × 480 (480p)"], ["Mídia", "Mini disco óptico de 8 cm"],
  ]),
  s("Nintendo", "home", "wii", "Com o controle de movimento, o Wii colocou famílias inteiras de pé na frente da TV, muito além do público habitual de consoles.", [
    ["Processador", "IBM PowerPC “Broadway”, 729 MHz"], ["Gráficos", "ATI “Hollywood”, 243 MHz"], ["Memória", "24 MB 1T-SRAM + 64 MB GDDR3"], ["Resolução", "Até 480p"], ["Mídia", "Disco óptico de 12 cm"], ["Destaque", "Retrocompatível com GameCube"],
  ]),
  s("Nintendo", "home", "wiiu", "O GamePad trouxe uma segunda tela para a sala. Vendeu pouco, mas preparou muitos jogos que depois chegaram ao Switch.", [
    ["Processador", "IBM “Espresso”, 3 núcleos, 1,24 GHz"], ["Gráficos", "AMD “Latte”, 550 MHz"], ["Memória", "2 GB DDR3"], ["Resolução", "Até 1080p"], ["Mídia", "Disco óptico de 25 GB"],
  ]),
  s("Nintendo", "hybrid", "switch", "Console de mesa e portátil ao mesmo tempo: tire da base, solte os Joy-Con e o jogo continua em qualquer lugar.", [
    ["Processador", "NVIDIA Tegra X1 (4 × ARM Cortex-A57)"], ["Gráficos", "NVIDIA Maxwell, 256 núcleos"], ["Memória", "4 GB LPDDR4"], ["Resolução", "720p no portátil, 1080p na TV"], CARD,
  ]),
  s("Nintendo", "handheld", "gb", "Tela verde, quatro pilhas e Tetris na caixa: o Game Boy fez do portátil um objeto do dia a dia.", [
    ["Processador", "Sharp LR35902, 4,19 MHz"], ["Memória", "8 KB + 8 KB de vídeo"], ["Resolução", "160 × 144, 4 tons"], CART,
  ]),
  s("Nintendo", "handheld", "gbc", "O Game Boy ganha cor sem perder a biblioteca: roda os cartuchos originais e recebeu os primeiros Pokémon em cores.", [
    ["Processador", "Sharp LR35902, até 8,39 MHz"], ["Memória", "32 KB + 16 KB de vídeo"], ["Resolução", "160 × 144, 56 cores simultâneas"], CART,
  ]),
  s("Nintendo", "handheld", "gba", "Formato deitado, processador ARM e uma das bibliotecas de pixel art mais caprichadas da história.", [
    ["Processador", "ARM7TDMI, 16,78 MHz"], ["Memória", "32 KB + 256 KB + 96 KB de vídeo"], ["Resolução", "240 × 160"], CART, ["Destaque", "Retrocompatível com Game Boy e Game Boy Color"],
  ]),
  s("Nintendo", "handheld", "nds", "Duas telas, uma delas sensível ao toque, microfone e caneta: o DS inventou jogos que nenhuma outra máquina comportava.", [
    ["Processador", "ARM946E-S 67 MHz + ARM7TDMI 33 MHz"], ["Memória", "4 MB"], ["Resolução", "2 telas de 256 × 192"], CARD,
  ]),
  s("Nintendo", "handheld", "3ds", "3D sem óculos na tela de cima, StreetPass entre jogadores que se cruzam e compatibilidade com toda a biblioteca do DS.", [
    ["Processador", "ARM11 MPCore dual core, 268 MHz"], ["Gráficos", "DMP PICA200"], ["Memória", "128 MB FCRAM"], ["Resolução", "800 × 240 (3D) e 320 × 240"], CARD,
  ]),
  s("Sony", "home", "ps1", "O primeiro passo da Sony: jogos em CD, 3D texturizado e mundos que deixaram o videogame crescer junto com quem jogava.", [
    ["Processador", "MIPS R3000A, 33,87 MHz"], ["Memória", "2 MB + 1 MB de vídeo"], ["Resolução", "256 × 224 a 640 × 480"], ["Mídia", "CD-ROM"],
  ]),
  s("Sony", "home", "ps2", "O console mais vendido de todos os tempos, que também era leitor de DVD e reuniu uma biblioteca de tamanho nunca mais visto.", [
    ["Processador", "Emotion Engine (MIPS R5900), 294,9 MHz"], ["Gráficos", "Graphics Synthesizer, 147,5 MHz"], ["Memória", "32 MB RDRAM + 4 MB de vídeo"], ["Mídia", "DVD-ROM e CD-ROM"], ["Destaque", "Retrocompatível com PlayStation"],
  ]),
  s("Sony", "home", "ps3", "O processador Cell, famoso por ser exigente, e o leitor Blu-ray fizeram dele uma das máquinas mais singulares já projetadas.", [
    ["Processador", "Cell Broadband Engine, 3,2 GHz"], ["Gráficos", "NVIDIA RSX, 500 MHz"], ["Memória", "256 MB XDR + 256 MB GDDR3"], ["Resolução", "Até 1080p"], ["Mídia", "Blu-ray"],
  ]),
  s("Sony", "home", "ps4", "Arquitetura de PC, botão Share e o online no centro da experiência: o PS4 liderou sua geração.", [
    ["Processador", "AMD Jaguar, 8 núcleos, 1,6 GHz"], ["Gráficos", "AMD GCN, 18 unidades de computação, 800 MHz"], ["Memória", "8 GB GDDR5"], ["Resolução", "Até 1080p"], ["Mídia", "Blu-ray"],
  ]),
  s("Sony", "handheld", "psp", "Tela larga 16:9, discos UMD e jogos de console no bolso: o PSP também foi o player de mídia de uma geração.", [
    ["Processador", "MIPS “Allegrex”, até 333 MHz"], ["Memória", "32 MB (PSP-1000)"], ["Resolução", "480 × 272"], ["Mídia", "UMD"],
  ]),
  s("Sony", "handheld", "vita", "Tela OLED, dois analógicos, frente sensível ao toque e touchpad traseiro: um portátil ambicioso que virou casa de muitos indies.", [
    ["Processador", "ARM Cortex-A9 MPCore, 4 núcleos"], ["Gráficos", "PowerVR SGX543MP4+"], ["Memória", "512 MB + 128 MB de vídeo"], ["Resolução", "960 × 544"], ["Mídia", "Cartão PlayStation Vita"],
  ]),
  s("Microsoft", "home", "xbox", "A Microsoft entrou na disputa com uma máquina pensada como um PC: HD interno, porta Ethernet e Halo para conquistar todo mundo.", [
    ["Processador", "Intel Pentium III (variante), 733 MHz"], ["Gráficos", "NVIDIA NV2A, 233 MHz"], ["Memória", "64 MB DDR"], ["Mídia", "DVD-ROM"], ["Destaque", "HD interno de 8 GB"],
  ]),
  s("Microsoft", "home", "x360", "Xbox Live, conquistas e Xbox Live Arcade fizeram do 360 o console que levou o jogo online para a sala.", [
    ["Processador", "IBM “Xenon”, 3 núcleos, 3,2 GHz"], ["Gráficos", "ATI “Xenos”, 500 MHz, 10 MB eDRAM"], ["Memória", "512 MB GDDR3"], ["Resolução", "Até 1080p"], ["Mídia", "DVD"],
  ]),
  s("Sega", "home", "sms", "Esquecido nos Estados Unidos, o Master System fez sucesso na Europa e no Brasil, onde continuou sendo fabricado por muitos anos.", [
    ["Processador", "Zilog Z80, 3,58 MHz"], ["Memória", "8 KB + 16 KB de vídeo"], ["Resolução", "256 × 192"], ["Mídia", "Cartucho e Sega Card"],
  ]),
  s("Sega", "home", "genesis", "Chamado de Genesis na América do Norte, levou a rivalidade com a Nintendo ao auge, com Sonic como garoto-propaganda.", [
    ["Processador", "Motorola 68000 7,67 MHz + Zilog Z80"], ["Gráficos", "VDP Sega 315-5313"], ["Memória", "64 KB + 64 KB de vídeo"], ["Resolução", "320 × 224"], CART,
  ]),
  s("Sega", "handheld", "gg", "Um Master System de bolso com tela colorida retroiluminada para enfrentar o Game Boy… e um apetite e tanto por pilhas.", [
    ["Processador", "Zilog Z80, 3,58 MHz"], ["Memória", "8 KB + 16 KB de vídeo"], ["Resolução", "160 × 144, paleta de 4.096 cores"], CART,
  ]),
  s("Sega", "home", "saturn", "Dois processadores, arquitetura exigente e conversões de arcade notáveis: o Saturn brilhou mais no Japão.", [
    ["Processador", "2 × Hitachi SH-2, 28,6 MHz"], ["Gráficos", "VDP1 e VDP2"], ["Memória", "2 MB + 1,5 MB de vídeo"], ["Mídia", "CD-ROM"],
  ]),
  s("Sega", "home", "dc", "Modem embutido, VMU com tela própria dentro do controle e ideias à frente do tempo: o último console da Sega ainda tem fãs fiéis.", [
    ["Processador", "Hitachi SH-4, 200 MHz"], ["Gráficos", "NEC PowerVR2, 100 MHz"], ["Memória", "16 MB + 8 MB de vídeo"], ["Resolução", "640 × 480"], ["Mídia", "GD-ROM (1 GB)"],
  ]),
  s("Atari", "home", "atari2600", "A frente de madeira e o joystick de um botão levaram o cartucho para milhões de casas.", [
    ["Processador", "MOS 6507, 1,19 MHz"], ["Gráficos", "TIA (Television Interface Adaptor)"], ["Memória", "128 bytes"], CART,
  ]),
  s("Vários", "arcade", "arcade", "Antes dos consoles vieram os fliperamas: cada gabinete é uma máquina diferente, e os emuladores reproduzem milhares de placas.", [
    ["Destaque", "Hardware próprio de cada gabinete"],
  ]),
]);

export const KIND_LABEL: Record<ConsoleKind, string> = { home: "Console de mesa", handheld: "Portátil", hybrid: "Híbrido", arcade: "Fliperama" };
