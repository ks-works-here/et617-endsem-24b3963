# The Optics Lab demonstration

Allow 3–5 minutes. Open the app, choose **Open investigation**, leave the default mission selected, and choose **Start investigation**.

1. Open **Lens theory and diagram guide** to see how to read the bench. Select “I expect a real image even inside the focal length.” Choose **Explore apparatus**. Keep the convex lens and 20 cm focal length. Move the screen or change the object's height, keeping the object distance at 12 cm.
2. Choose **Prepare experiment**, predict **Real image on a screen**, and click **Run Experiment**. Move the screen again. The screen remains unfocused.
3. Open each hint in order. Select “The rays diverge and only their backward extensions meet.” Open the explanation. Choose **Try a different setup**, select “Moving outside F will form a real image,” and save the revision.
4. Pause and refresh. Use **Resume Investigation**. Set the object distance and screen position to 40 cm using the number fields. Select a real image prediction again and run the trial. The screen shows a sharp inverted image with magnification −1. Open **Compare saved trials** to see how the setup, prediction, and result changed.
5. Choose **What did you learn?** Pick the lens that can project a real image in the new setup. Select a takeaway from the trials and complete the investigation.
6. Follow the related Arena question. Select an explanation, access a hint, bookmark the question, and reveal the worked solution. Optionally start a mixed or timed set.
7. Open **Analytics**. Expand the failed trial and its revision, browse the clickstream, and download CSV, JSON, and experiment history. Refresh to confirm that the export log persists.

## Recorded examples

These records were captured from the automated Chrome demonstration. The run used a new browser profile.

### Unsuccessful experiment and saved revision

```json
[
  {
    "event_id": "05f92f79-f5af-4af0-a4ee-cb38645ff5ef",
    "session_id": "fe574e0c-a058-45e8-af84-ca3bacf64fd6",
    "learner_id": "75850148-1598-49c6-9127-75fbb03204b3",
    "timestamp": "2026-11-18T13:32:53.409Z",
    "event_type": "experiment_unsuccessful",
    "investigation_id": "lens-bench",
    "experiment_id": "17116a32-ea72-4980-af68-8bc27a713567",
    "step": "Experiment",
    "details": {
      "settings": {
        "type": "convex",
        "focal": 20,
        "distance": 12,
        "height": 6,
        "screen": 40
      },
      "hypothesis": "I expect a real image even inside the focal length.",
      "prediction": "real",
      "outcome": "virtual",
      "supported": false,
      "image_distance_cm": -30.000000000000007,
      "magnification": 2.5000000000000004,
      "image_height_cm": 15.000000000000004,
      "screen_sharp": false
    }
  },
  {
    "event_id": "16a2c9c5-6860-46ff-abfd-8bf25c99b106",
    "session_id": "fe574e0c-a058-45e8-af84-ca3bacf64fd6",
    "learner_id": "75850148-1598-49c6-9127-75fbb03204b3",
    "timestamp": "2026-11-18T13:32:53.723Z",
    "event_type": "hypothesis_revised",
    "investigation_id": "lens-bench",
    "experiment_id": "17116a32-ea72-4980-af68-8bc27a713567",
    "step": "Interpret & revise",
    "details": {
      "settings": {
        "type": "convex",
        "focal": 20,
        "distance": 12,
        "height": 6,
        "screen": 55
      },
      "original": "I expect a real image even inside the focal length.",
      "revision": "Moving outside F will form a real image.",
      "interpretation": "The rays diverge and only their backward extensions meet."
    }
  }
]
```

### Export history entry

```json
{
  "export_id": "cf60ffe1-eee2-4d0b-9737-de7a5ee5d7a2",
  "timestamp": "2026-11-18T13:32:58.122Z",
  "format": "CSV",
  "filename": "optics-clickstream-2026-11-18T13-32-58.122Z.csv",
  "records": 63,
  "status": "download requested"
}
```
