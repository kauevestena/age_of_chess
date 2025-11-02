import os, json, pygame
from implementation.age_of_chess.pettingzoo_env import age_of_chess_v0
from implementation.age_of_chess.utils import encode_action

TILE = 72
W, H = 8*TILE, 8*TILE
FONT_SIZE = 22

COLORS = {
    "light": (230, 220, 200),
    "dark": (160, 130, 90),
    "north": (40, 60, 130),
    "south": (150, 40, 40),
    "text": (10, 10, 10),
}

SYMBOL = {"P":"P","N":"C","B":"A","R":"H","Q":"S","K":"K"}

def draw_board(screen, env):
    import pygame
    font = pygame.font.SysFont("arial", FONT_SIZE, bold=True)
    engine = env.unwrapped.engine
    for r in range(8):
        for c in range(8):
            color = COLORS["light"] if (r+c)%2==0 else COLORS["dark"]
            pygame.draw.rect(screen, color, (c*TILE, r*TILE, TILE, TILE))
            sq = engine.state.board.grid[r][c]
            y = r*TILE + TILE//2 + 10
            x = c*TILE + TILE//2
            for idx, u in enumerate(filter(None, [sq.bottom, sq.top])):
                if u:
                    col = COLORS["north"] if u.side=="north" else COLORS["south"]
                    pygame.draw.circle(screen, col, (x, y-20*idx), 20)
                    txt = font.render(SYMBOL[u.code], True, COLORS["text"])
                    screen.blit(txt, (x-7, y-20*idx-12))

def load_events(jsonl_path):
    events = []
    with open(jsonl_path, "r") as f:
        for line in f:
            if not line.strip(): continue
            rec = json.loads(line)
            events.append(rec)
    return events

def main(jsonl_path):
    events = load_events(jsonl_path)
    env = age_of_chess_v0(ruleset_path="rulesets/default.yaml")
    env.reset()
    idx = 0
    running = True
    pygame.init()
    screen = pygame.display.set_mode((W,H))
    pygame.display.set_caption("Age of Chess – Replay Viewer (LEFT/RIGHT to step)")
    clock = pygame.time.Clock()

    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_RIGHT:
                    if idx < len(events):
                        ev = events[idx]
                        # reconstruct action tuple
                        fr,fc = ev["from"]
                        tr,tc = ev["to"]
                        slot = ev.get("slot", 0)
                        atype = ev["atype"]
                        from implementation.age_of_chess.utils import encode_action
                        aidx = encode_action(fr,fc,slot,atype,tr,tc)
                        env.step(aidx)
                        idx += 1
                if event.key == pygame.K_LEFT:
                    # full reset and replay up to idx-1 for simplicity
                    if idx > 0:
                        env.reset()
                        idx -= 1
                        for j in range(idx):
                            ev = events[j]
                            fr,fc = ev["from"]; tr,tc = ev["to"]
                            slot = ev.get("slot", 0); atype = ev["atype"]
                            aidx = encode_action(fr,fc,slot,atype,tr,tc)
                            env.step(aidx)

        draw_board(screen, env)
        pygame.display.flip()
        clock.tick(30)

    pygame.quit()

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python implementation/examples/replay_viewer.py logs/game_YYYYMMDD_HHMMSS.jsonl")
    else:
        main(sys.argv[1])
