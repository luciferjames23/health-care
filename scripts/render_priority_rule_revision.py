"""Revise only the model/rule explanation in the existing current UI demo."""
import shutil
import render_current_ui_demo as demo

original=demo.BUILD
demo.BUILD=demo.CAP/"rule_revision"
demo.BUILD.mkdir(parents=True,exist_ok=True)
for i in range(len(demo.SCENES)):
    if i==5:continue
    for extension in ("mp3","json"):
        shutil.copy2(original/f"{i:02}.{extension}",demo.BUILD/f"{i:02}.{extension}")
demo.OUT=demo.ROOT/"docs/AI_Radiology_Current_UI_OHIF_Model_Rules.mp4"
demo.SCENES[5]=dict(
    file="03_worklist",title="04 / MODELS & PRIORITY RULES",
    sub="Configured thresholds → combined model signals → review priority",
    text="DenseNet one twenty one screens for opacity at a twenty percent probability threshold. YOLO eleven nano localizes opacity at ten percent confidence or above. Both models positive means high priority. Exactly one positive means medium priority. Neither model flags opacity means low priority. Low priority still requires radiologist review.",
    crop=(215,365,1274,450),cues=[],rules=True,
)
if __name__=="__main__":demo.main()
