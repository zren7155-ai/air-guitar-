import cv2
import mediapipe as mp
import pygame
import time
from pathlib import Path

# Init
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(max_num_hands=2, min_detection_confidence=0.7)
mp_draw = mp.solutions.drawing_utils
pygame.init()
pygame.mixer.init()
BASE_DIR = Path(__file__).resolve().parent
SOUNDS_DIR = BASE_DIR / "sounds"
CHORD_FILES = ["1.mp3", "2.mp3", "EM.mp3", "GM.mp3", "3.mp3", "4.mp3"]

# Load music files
chords = {
    index: pygame.mixer.Sound(str(SOUNDS_DIR / filename))
    for index, filename in enumerate(CHORD_FILES)
}

# Count fingers
def count_fingers(hand_landmarks, hand_type):
    tips = [4, 8, 12, 16, 20]
    fingers = []

    # Thumb
    if hand_type == "Right":
        fingers.append(hand_landmarks.landmark[tips[0]].x < hand_landmarks.landmark[tips[0] - 1].x)
    else:
        fingers.append(hand_landmarks.landmark[tips[0]].x > hand_landmarks.landmark[tips[0] - 1].x)

    # 4 fingers
    for tip in tips[1:]:
        fingers.append(hand_landmarks.landmark[tip].y < hand_landmarks.landmark[tip - 2].y)

    return fingers.count(True)

# Detect strum = right hand vel
last_strum_y = None
last_strum_time = 0
def detect_strum(y):
    global last_strum_y, last_strum_time
    if last_strum_y is None:
        last_strum_y = y
        return False

    speed = abs(y - last_strum_y)
    last_strum_y = y

    current_time = time.time()
    if speed > 0.03 and current_time - last_strum_time > 0.5:
        last_strum_time = current_time
        return True
    return False


cap = cv2.VideoCapture(0)
if not cap.isOpened():
    raise RuntimeError("Could not open webcam. Check camera permission or device index.")

current_chord = 0
while cap.isOpened():
    success, img = cap.read()
    if not success:
        continue

    img = cv2.flip(img, 1)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = hands.process(img_rgb)

    if results.multi_hand_landmarks and results.multi_handedness:
        for hand_landmarks, handedness in zip(results.multi_hand_landmarks, results.multi_handedness):
            hand_type = handedness.classification[0].label
            mp_draw.draw_landmarks(img, hand_landmarks, mp_hands.HAND_CONNECTIONS)

            cx = int(hand_landmarks.landmark[0].x * img.shape[1])
            cy = int(hand_landmarks.landmark[0].y * img.shape[0])

            if hand_type == "Left":
                # Left hand = chord
                current_chord = count_fingers(hand_landmarks, hand_type)
                cv2.putText(img, f"Chord: {current_chord}", (10, 50),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            else:
                # Right hand = strum
                if detect_strum(hand_landmarks.landmark[0].y):
                    chords[current_chord].play()
                    cv2.putText(img, "Strum!", (400, 50),
                                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)

    cv2.imshow("Air Guitar 🎸", img)
    if cv2.waitKey(1) == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
