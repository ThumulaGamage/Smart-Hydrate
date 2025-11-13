import { realtimeDB } from '../config/firebaseConfig'; // Using compat version

class ChartDataService {
  constructor(userId) {
    this.userId = userId;
  }

  async getUserProfile() {
      try {
        const profileRef = realtimeDB.ref(`users/${this.userId}/profile`);
        const snapshot = await profileRef.once('value');
        
        if (snapshot.exists()) {
          return snapshot.val();
        }
        return null;
      } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }
    }

    
    async getMonthlyData(year = null, month = null) {
      try {
        const today = new Date();
        const targetYear = year || today.getFullYear();
        const targetMonth = month !== null ? month : today.getMonth();
        
        console.log(`📅 Getting data for ${targetYear}-${targetMonth + 1}`);
        
        // Get first and last day of month
        const firstDay = new Date(targetYear, targetMonth, 1);
        const lastDay = new Date(targetYear, targetMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        
        console.log(`📅 Days in month: ${daysInMonth}`);
        
        // Fetch daily stats for the month
        const dailyStatsRef = realtimeDB.ref(`users/${this.userId}/dailyStats`);
        const snapshot = await dailyStatsRef.once('value');
        
        const monthData = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(targetYear, targetMonth, day);
          const dateString = date.toISOString().split('T')[0];
          
          let consumed = 0;
          
          // Check if we have stats for this date
          if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
              if (childSnapshot.key === dateString) {
                const stats = childSnapshot.val();
                consumed = stats.totalConsumed || 0;
              }
            });
          }
          
          monthData.push({
            date: dateString,
            day,
            consumed,
            dayOfWeek: date.getDay()
          });
        }
        
        console.log(`📊 Month data prepared: ${monthData.length} days`);
        return monthData;
        
      } catch (error) {
        console.error('❌ Error getting monthly data:', error);
        return [];
      }
    }
  async getHourlyPattern(date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
      
      console.log('📅 Target date:', targetDate);
      
      // Fetch drinking events from Firebase using Compat
      const eventsRef = realtimeDB.ref(`users/${this.userId}/drinkingEvents`);
      const snapshot = await eventsRef.once('value');
      
      console.log('🔥 Snapshot exists:', snapshot.exists());
      
      if (!snapshot.exists()) {
        console.log('⚠️ No drinking events found');
        return this.getEmptyHourlyData();
      }

      // Initialize 24 hours with 0
      const hourlyData = Array(24).fill(0);
      let eventCount = 0;
      
      // Process events and aggregate by hour
      snapshot.forEach((childSnapshot) => {
        const event = childSnapshot.val();
        console.log('📝 Event:', event);
        
        // Check if event is for target date
        if (event.date === targetDate) {
          eventCount++;
          const hour = new Date(event.timestamp).getHours();
          hourlyData[hour] += event.volume || 0;
          console.log(`✅ Added ${event.volume}ml to hour ${hour}`);
        }
      });
      
      console.log(`📊 Total events for ${targetDate}:`, eventCount);
      console.log('📊 Hourly totals:', hourlyData);
      
      // Format data for chart
      return hourlyData.map((volume, hour) => ({
        hour,
        volume,
        label: `${hour.toString().padStart(2, '0')}:00`
      }));
      
    } catch (error) {
      console.error('❌ Error getting hourly pattern:', error);
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