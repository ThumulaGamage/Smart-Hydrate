import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  section: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  
  // Water Bottle Styles
  bottleContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  bottleOutline: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bottleCap: {
    width: 35,
    height: 18,
    borderRadius: 10,
    marginBottom: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bottleNeck: {
    width: 25,
    height: 25,
    borderWidth: 2,
    marginBottom: 3,
  },
  bottleBody: {
    width: 90,
    height: 220,
    borderWidth: 3,
    borderRadius: 15,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  waterLevel: {
    width: '100%',
    borderRadius: 12,
    position: 'absolute',
    bottom: 0,
  },
  levelMarkers: {
    position: 'absolute',
    right: -45,
    height: '100%',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  levelMarker: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markerLine: {
    width: 18,
    height: 2,
    marginRight: 6,
  },
  markerText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bottleBase: {
    width: 95,
    height: 12,
    borderRadius: 6,
    marginTop: 3,
  },
  waterLevelText: {
    alignItems: 'center',
  },
  waterPercentage: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  waterLevelLabel: {
    fontSize: 16,
    marginBottom: 16,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },

  // Progress Styles
  progressContainer: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  progressCurrent: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  progressGoal: {
    fontSize: 16,
    fontWeight: '500',
  },
  progressBar: {
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercentage: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  progressFooter: {
    alignItems: 'center',
  },
  remainingText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Quick Actions Styles
  quickDrinkActions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickDrinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickDrinkText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Chart Styles
  chartContainer: {
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chart: {
    borderRadius: 16,
    marginVertical: 8,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 150,
    borderRadius: 12,
  },
  chartPlaceholderText: {
    fontSize: 14,
    marginTop: 8,
  },

  // Recommendations Styles
  recommendationsContainer: {
    borderRadius: 12,
    padding: 16,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 12,
    lineHeight: 20,
  },
  noRecommendations: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noRecommendationsText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },

  // Connection Styles
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  statusTextMain: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  buttonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  connectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Summary Grid Styles
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});