# 💧 Smart Hydrate  
### IoT-Based Personalized Hydration Monitoring & Tracking System  

> **Final Year Project — Group 11**  
> M.G.T.D. Gamage · A.P.G.C.L. Wijesinghe · H.M.K.V. Herath  
> Department of Computer Engineering  
> University of Sri Jayewardenepura  

---

## 1. Introduction  

**Smart Hydrate** is an IoT-driven smart hydration monitoring system that combines embedded hardware, Bluetooth communication, cloud infrastructure, and a cross-platform mobile application to provide automated, real-time water intake tracking.

Unlike traditional hydration applications that require manual logging, Smart Hydrate utilizes precision weight sensing and motion detection to automatically detect drinking events and calculate consumed volume with high accuracy.

The system is designed not only for general wellness but also to support structured medical hydration plans for patients requiring controlled fluid intake.

---

## 2. System Objectives  

The primary objectives of Smart Hydrate are:

- Deliver high-precision real-time hydration measurement  
- Automate drinking event detection  
- Provide temperature monitoring for beverage safety  
- Support personalized medical hydration protocols  
- Encourage behavioral improvement through intelligent reminders  
- Enable secure long-term hydration data storage and analysis  

---

## 3. Technical Specifications  

| Parameter | Specification |
|------------|--------------|
| Water Level Accuracy | ±5 ml (Load Cell + HX711, R² = 0.998) |
| Temperature Accuracy | ±0.5 °C (DS18B20) |
| Drinking Detection Accuracy | 92% (MPU6050-based motion validation) |
| BLE Communication Stability | >99% uptime (72-hour continuous test) |
| Battery Capacity | 2000mAh (18650 Li-ion) |
| Operating Duration | 60–72 hours per charge |
| Charging Module | TP4056 USB-C |
| Total Hardware Cost | LKR 12,500 |

---

## 4. Hardware System Design  

The hardware system is enclosed in a custom-designed 3D-printed PETG base module, engineered for portability, durability, and sensor stability.

### 4.1 Core Components  

| Component | Role in System |
|------------|----------------|
| ESP32 NodeMCU | Primary microcontroller with BLE & Wi-Fi capabilities |
| 5kg Load Cell + HX711 | High-resolution water weight measurement |
| DS18B20 Waterproof Sensor | Continuous temperature sensing |
| MPU6050 (Accelerometer + Gyroscope) | Motion-based drinking detection |
| 0.96" OLED Display | Local real-time system feedback |
| 18650 Battery + TP4056 | Rechargeable power management system |

### 4.2 Hardware Functional Features  

- Precision weight-to-volume conversion  
- Dual-validation drinking detection (motion + weight drop)  
- On-device real-time display  
- Low-power firmware optimization  
- Rechargeable, portable design  

---

## 5. Mobile Application Architecture  

The Smart Hydrate mobile application is developed using **React Native**, enabling cross-platform deployment for Android and iOS.

### 5.1 Technology Stack  

- React Native 0.79.2  
- Firebase Authentication  
- Firebase Realtime Database  
- Firebase Firestore  
- Supabase Storage  
- react-native-ble-plx (BLE Communication)  
- React Navigation  

---

## 6. Application Functional Modules  

### 6.1 Home Dashboard  

- Real-time water level visualization  
- Live temperature monitoring  
- BLE connectivity status indicator  
- Circular hydration progress tracker  
- Battery level display  

### 6.2 Analytics & Progress Monitoring  

- Daily and weekly hydration statistics  
- Intake history logging  
- Achievement badge system  
- Trend-based intake visualization  

### 6.3 Medical Hydration Plans  

Predefined medical hydration configurations include:

- **Kidney Disease** – Fluid restriction monitoring with alert thresholds  
- **Dengue Recovery** – High-volume hydration protocol (3–4L/day)  
- **Heart Conditions** – Controlled fluid intake with upper-limit warnings  
- **Diabetes** – Structured hydration scheduling (2.5–3L/day target)  

Each plan supports customization based on individual medical recommendations.

### 6.4 Intelligent Notification System  

- Adaptive reminder intervals  
- Quiet hour configuration  
- Missed hydration detection  
- Intake limit exceed warnings  
- Behavioral pattern-based adjustments  

### 6.5 Device & User Management  

- BLE device pairing  
- Profile management  
- Notification preferences  
- Data export capability  
- Hydration goal customization  

---

## 7. Intelligent Hydration Engine  

The system incorporates a rule-based decision engine that:

- Dynamically adjusts reminder frequency  
- Detects hydration deficiency trends  
- Identifies abnormal consumption patterns  
- Triggers alerts for medical threshold violations  
- Evaluates long-term hydration consistency  

This module bridges raw sensor data with actionable user guidance.

---


