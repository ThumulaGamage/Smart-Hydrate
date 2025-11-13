import { database } from '../firebaseConfig'; // Adjust path to your firebase config
import { ref, get } from 'firebase/database';

class ChartDataService {
  constructor(userId) {
    this.userId = userId;
  }

  /**
   * Get hourly breakdown for today
   */
  async getHourlyPattern(date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
      
      // Fetch drinking events from Firebase
      const eventsRef = ref(database, `users/${this.userId}/drinkingEvents`);
      const snapshot = await get(eventsRef);
      
      if (!snapshot.exists()) {
        return this.getEmptyHourlyData();
      }

      // Initialize 24 hours with 0
      const hourlyData = Array(24).fill(0);
      
      // Process events and aggregate by hour
      snapshot.forEach((childSnapshot) => {
        const event = childSnapshot.val();
        
        // Check if event is for target date
        if (event.date === targetDate) {
          const hour = new Date(event.timestamp).getHours();
          hourlyData[hour] += event.volume || 0;
        }
      });
      
      // Format data for chart
      return hourlyData.map((volume, hour) => ({
        hour,
        volume,
        label: `${hour.toString().padStart(2, '0')}:00`
      }));
      
    } catch (error) {
      console.error('Error getting hourly pattern:', error);
      return this.getEmptyHourlyData();
    }
  }

  /**
   * Get empty hourly data structure
   */
  getEmptyHourlyData() {
    return Array(24).fill(0).map((_, hour) => ({
      hour,
      volume: 0,
      label: `${hour.toString().padStart(2, '0')}:00`
    }));
  }
}

export default ChartDataService;