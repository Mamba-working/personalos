import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent));from continuous_water import Water
w=Water(audit=True)
