import _script_setup  # noqa: F401

import pygame
from implementation.age_of_chess.pettingzoo_env import age_of_chess_v0
from implementation.age_of_chess.env import Engine
from implementation.age_of_chess.agents import GreedyAgent
from implementation.age_of_chess.utils import encode_action

from implementation.age_of_chess.combat import POSITIONS

TILE = 72
W, H = 8*TILE, 8*TILE
FONT_SIZE = 22

COLORS = {
    "light": (230, 220, 200),
    "dark": (160, 130, 90),
    "north": (40, 60, 130),
    "south": (150, 40, 40),
    "move": (40, 160, 60),
    "melee": (200, 60, 60),
    "ranged": (60, 120, 200),
    "convert": (150, 60, 160),
    "text": (10, 10, 10),
    "P": (30, 140, 80),
    "N": (200, 120, 40),
    "B": (60, 120, 200),
    "R": (160, 60, 60),
    "Q": (140, 60, 160),
    "K": (60, 60, 60),
}

SYMBOL = {"P":"P","N":"C","B":"A","R":"H","Q":"S","K":"K"}

def draw_board(screen, env, show_legal=False):
    font = pygame.font.SysFont("arial", FONT_SIZE, bold=True)
    engine = env.unwrapped.engine
    for r in range(8):
        for c in range(8):
            color = COLORS["light"] if (r+c)%2==0 else COLORS["dark"]
            pygame.draw.rect(screen, color, (c*TILE, r*TILE, TILE, TILE))
            sq = engine.state.board.grid[r][c]
            for slot, u in enumerate((sq.top, sq.bottom)):
                if u:
                    position = POSITIONS[sq.layout][slot] if sq.bottom else "center"
                    dx,dy = {"N":(0,-16), "S":(0,16), "W":(-16,0), "E":(16,0), "center":(0,0)}[position]
                    x,y = c*TILE+TILE//2+dx, r*TILE+TILE//2+dy
                    col = COLORS[u.side]
                    pygame.draw.circle(screen, col, (x,y), 16)
                    txt = font.render(SYMBOL[u.code], True, COLORS["text"])
                    screen.blit(txt, (x-7,y-12))


    if show_legal:
        engine = env.unwrapped.engine
        legal = engine.legal_actions()
        for fr,fc,slot,tr,tc,atype in legal:
            # determine actor piece at source/slot
            src = engine.state.board.grid[fr][fc]
            actor = (src.top if slot==0 else src.bottom).code if (slot==0 and src.top) or (slot==1 and src.bottom) else "P"
            col = COLORS.get(actor, COLORS["move"])
            cx, cy = tc*TILE + TILE//2, tr*TILE + TILE//2
            if atype == 0:
                pygame.draw.circle(screen, col, (cx, cy), 8)
            elif atype == 1:
                pygame.draw.rect(screen, col, (tc*TILE+TILE//2-8, tr*TILE+TILE//2-8, 16, 16))
            elif atype in (2,8):
                pygame.draw.circle(screen, col, (cx, cy), 10, 2)
            elif atype == 3:
                pygame.draw.circle(screen, col, (cx, cy), 12, 2)

        legal = env.unwrapped.engine.legal_actions()
        for fr,fc,slot,tr,tc,atype in legal:
            cx, cy = tc*TILE + TILE//2, tr*TILE + TILE//2
            if atype == 0:
                pygame.draw.circle(screen, COLORS["move"], (cx, cy), 8)
            elif atype == 1:
                pygame.draw.rect(screen, COLORS["melee"], (tc*TILE+TILE//2-8, tr*TILE+TILE//2-8, 16, 16))
            elif atype in (2,8):
                pygame.draw.circle(screen, COLORS["ranged"], (cx, cy), 8, 2)
            elif atype == 3:
                pygame.draw.circle(screen, COLORS["convert"], (cx, cy), 12, 2)

def draw_labels(screen):
    font = pygame.font.SysFont("arial", 14)
    files = "abcdefgh"
    ranks = "87654321"
    for c, f in enumerate(files):
        txt = font.render(f, True, (20,20,20))
        screen.blit(txt, (c*TILE + TILE-14, 8))
    for r, rk in enumerate(ranks):
        txt = font.render(rk, True, (20,20,20))
        screen.blit(txt, (8, r*TILE + TILE-18))

def main():
    pygame.init()
    screen = pygame.display.set_mode((W,H))
    pygame.display.set_caption("Age of Chess – Viewer (Click: select/move, TAB: toggle slot, L: legal, G: greedy, SPACE: random; A: auto, M: move/melee, R: ranged, C: convert)")
    clock = pygame.time.Clock()
    env = age_of_chess_v0(ruleset_path="rulesets/default.yaml")
    env.reset()
    greedy = GreedyAgent()
    show_legal = True
    selected = None  # (r,c)
    selected_slot = 0  # A=0, B=1
    target_slot = 0
    action_mode = None  # A=auto, M=move/melee, R=ranged, C=conversion

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_a: action_mode = None
                if event.key == pygame.K_m: action_mode = "melee"
                if event.key == pygame.K_r: action_mode = "ranged"
                if event.key == pygame.K_c: action_mode = "convert"
                if event.key == pygame.K_t: target_slot = 1-target_slot
                if event.key in (pygame.K_1,pygame.K_2,pygame.K_3,pygame.K_4) and selected is not None:
                    fr,fc=selected
                    layout=(pygame.K_1,pygame.K_2,pygame.K_3,pygame.K_4).index(event.key)
                    action=(fr,fc,0,fr,fc,4+layout)
                    if action in env.unwrapped.engine.legal_actions(): env.step(encode_action(*action))
                if event.key == pygame.K_SPACE:
                    agent = env.agent_selection
                    if env.terminations.get(agent) or env.truncations.get(agent):
                        continue
                    mask = env.infos[agent]["action_mask"]
                    legal_idxs = [i for i,m in enumerate(mask) if m==1]
                    if legal_idxs:
                        import random
                        env.step(random.choice(legal_idxs))
                        selected = None
                if event.key == pygame.K_g:
                    engine = env.unwrapped.engine
                    act = greedy.select(engine)
                    if act is not None:
                        idx = encode_action(*act)
                        agent = env.agent_selection
                        if env.terminations.get(agent) or env.truncations.get(agent):
                            continue
                        env.step(idx)
                        selected = None
                if event.key == pygame.K_l:
                    show_legal = not show_legal
                if event.key == pygame.K_TAB:
                    selected_slot = 1 - selected_slot
            if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                mx, my = pygame.mouse.get_pos()
                r, c = my // TILE, mx // TILE
                engine = env.unwrapped.engine
                legal = engine.legal_actions()
                if selected is None:
                    # select source if piece present for current side and matches slot
                    sq = engine.state.board.grid[r][c]
                    u = (sq.top if selected_slot==0 else sq.bottom)
                    if u is not None and u.side == env.agent_selection:
                        selected = (r,c)
                else:
                    # attempt to find a legal action matching selection -> (r,c) to (r2,c2)
                    fr, fc = selected
                    candidates = [a for a in legal if a[0]==fr and a[1]==fc and a[2]==selected_slot and a[3]==r and a[4]==c]
                    allowed_types = {None: (0, 1, 2, 3, 8), "melee": (0, 1), "ranged": (2,8), "convert": (3,)}
                    candidates = [a for a in candidates if a[5] in allowed_types[action_mode]]
                    if candidates:
                        # Auto prefers abilities; M/R/C lets the player choose explicitly.
                        best = sorted(candidates, key=lambda a: {2:0 if target_slot==0 else 1,8:0 if target_slot==1 else 1,3:2,1:3,0:4}[a[5]])[0]
                        idx = encode_action(*best)
                        agent = env.agent_selection
                        if not (env.terminations.get(agent) or env.truncations.get(agent)):
                            env.step(idx)
                    selected = None

        state = env.unwrapped.engine.state
        status = f"{state.winner or 'unresolved'}: {state.reason}" if state.done else f"{state.to_move} to move"
        pygame.display.set_caption(f"Age of Chess | {status} | mode: {action_mode or 'auto'} (A/M/R/C) | layout 1–4, target {'B' if target_slot else 'A'} (T) | prepared {len(state.prepared)}/3")
        # draw
        draw_board(screen, env, show_legal=show_legal)
        draw_labels(screen)
        # selection highlight
        if selected is not None:
            sr, sc = selected
            pygame.draw.rect(screen, (20,200,20), (sc*TILE+4, sr*TILE+4, TILE-8, TILE-8), 2)
        pygame.display.flip()
        clock.tick(30)
    pygame.quit()

if __name__ == "__main__":
    main()
