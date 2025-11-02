import os, time, json, datetime
from implementation.age_of_chess.pettingzoo_env import age_of_chess_v0
from implementation.age_of_chess.agents import GreedyAgent
from implementation.age_of_chess.utils import encode_action

FILES_DIR = "logs"

def idx_to_sq(r,c):
    files = "abcdefgh"
    ranks = "87654321"
    return f"{files[c]}{ranks[r]}"

def pretty_move(event):
    fr,fc = event["from"]
    tr,tc = event["to"]
    actor = event.get("actor","?")
    sq_from = idx_to_sq(fr,fc); sq_to = idx_to_sq(tr,tc)
    if event["atype"] == 0:
        return f"{actor} {sq_from}-{sq_to}"
    if event["atype"] == 1:
        tgt = event.get("capture",{}).get("def_top","?")
        return f"{actor} {sq_from}x{sq_to} ({tgt})"
    if event["atype"] == 2:
        rng = event.get("ranged",{})
        tgt = rng.get("killed","?")
        flag = " PS" if rng.get("power_shot") else ""
        return f"{actor} {sq_from}~{sq_to} ({tgt}{flag})"
    if event["atype"] == 3:
        conv = event.get("convert",{}).get("converted","?")
        return f"{actor} {sq_from}>{sq_to} (convert {conv})"
    return f"{actor} {sq_from}?{sq_to}"

def main():
    env = age_of_chess_v0(ruleset_path="rulesets/default.yaml")
    env.reset()
    agents = {"north": GreedyAgent(), "south": GreedyAgent()}
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    jsonl_path = os.path.join(FILES_DIR, f"game_{ts}.jsonl")
    pgn_path = os.path.join(FILES_DIR, f"game_{ts}.aocpgn")

    with open(jsonl_path, "w") as jf, open(pgn_path,"w") as pf:
        move_no = 1
        while True:
            agent = env.agent_selection
            engine = env.unwrapped.engine
            act = agents[agent].select(engine)
            if act is None:
                break
            idx = encode_action(*act)
            env.step(idx)
            event = env.unwrapped.history[-1]
            event_record = {"move_no": move_no if agent=='north' else move_no+0.5, "agent": agent, **event}
            jf.write(json.dumps(event_record)+"\n")
            if agent == "north":
                pf.write(f"{move_no}. {pretty_move(event)} ")
            else:
                pf.write(f"{pretty_move(event)}\n")
                move_no += 1
            if env.terminations["north"] and env.terminations["south"]:
                pf.write(f"Result: rewards={env.rewards}\n")
                break
    print("Wrote:", jsonl_path, pgn_path)

if __name__ == "__main__":
    main()
