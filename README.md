# 💧 Smart Hydrate

## IoT-Based Personalized Hydration Monitoring & Tracking System

 **Computer Engineering Project --- Group 11**\
 M.G.T.D. Gamage · A.P.G.C.L. Wijesinghe · H.M.K.V. Herath\
 Department of Computer Engineering\
 University of Sri Jayewardenepura

------------------------------------------------------------------------

## 📌 Project Overview

**Smart Hydrate** is a fully integrated Internet of Things (IoT)--based
smart hydration monitoring system designed to automatically measure,
analyze, and optimize daily water intake in real time.

Unlike traditional hydration tracking applications that rely on manual
input, Smart Hydrate utilizes embedded sensors, Bluetooth Low Energy
(BLE) communication, and cloud synchronization to deliver accurate,
automated hydration tracking.

The system consists of:

-   A smart hardware base unit with embedded sensors\
-   A BLE-enabled ESP32 microcontroller\
-   A cross-platform mobile application (Android & iOS)\
-   Cloud-based real-time data storage\
-   An intelligent hydration recommendation engine

------------------------------------------------------------------------

## 🎯 Project Objectives

-   Deliver accurate real-time water intake measurement\
-   Automatically detect drinking events\
-   Monitor water temperature continuously\
-   Provide medical-condition-based hydration plans\
-   Offer adaptive smart reminders\
-   Store and analyze long-term hydration data\
-   Enable secure cloud synchronization

------------------------------------------------------------------------

## 🏗 System Architecture

Smart Hydrate follows a four-layer IoT architecture:

### 1️⃣ Hardware Layer

-   Load Cell + HX711 amplifier for weight measurement\
-   MPU6050 motion sensor for drinking detection\
-   DS18B20 waterproof sensor for temperature monitoring\
-   ESP32 NodeMCU microcontroller\
-   OLED display for on-device feedback\
-   18650 Li-ion battery with TP4056 charging module

### 2️⃣ Communication Layer

-   Bluetooth Low Energy (BLE) for real-time data transmission\
-   Secure pairing and device authentication

### 3️⃣ Application Layer

-   React Native mobile application\
-   Real-time hydration dashboard\
-   Progress analytics\
-   Medical plan configuration\
-   Notification engine

### 4️⃣ Cloud Layer

-   Firebase Authentication\
-   Firebase Realtime Database\
-   Firebase Firestore\
-   Supabase Storage

------------------------------------------------------------------------

## 🔬 Technical Specifications

  Feature                       Performance
  ----------------------------- ------------------------
  Water Level Accuracy          ±5ml (R² = 0.998)
  Temperature Accuracy          ±0.5°C
  Drinking Detection Accuracy   92%
  BLE Uptime                    \>99%
  Battery Life                  60--72 Hours
  Battery Type                  18650 Li-ion (2000mAh)
  Charging                      USB-C (TP4056)
  Total Hardware Cost           LKR 12,500

------------------------------------------------------------------------

## 📱 Mobile Application

### Technology Stack

-   React Native 0.79.2\
-   Firebase Authentication\
-   Firebase Realtime Database\
-   Firebase Firestore\
-   Supabase Storage\
-   react-native-ble-plx\
-   React Navigation

------------------------------------------------------------------------

## 📊 Performance Evaluation

-   72-hour continuous BLE stress testing\
-   Sensor calibration with R² = 0.998\
-   92% drinking detection accuracy\
-   Stable real-time cloud synchronization

------------------------------------------------------------------------

## 🚀 Future Improvements

-   AI-based hydration prediction\
-   Weather-based hydration adjustment\
-   Smartwatch integration\
-   Machine learning drinking behavior classification\
-   Commercial-grade enclosure refinement

------------------------------------------------------------------------

## 📌 Conclusion

Smart Hydrate successfully demonstrates a complete IoT-based
personalized hydration monitoring system integrating embedded systems,
mobile development, cloud computing, and intelligent health analytics.
