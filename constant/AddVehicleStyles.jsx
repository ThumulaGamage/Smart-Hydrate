import { StyleSheet } from 'react-native';
import Colors from './Colors'; // Adjust path as needed

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.WHITE,
  },

  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: Colors.GRAY_LIGHT,
  },

  backButton: {
    padding: 8,
    borderRadius: 8,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.BLUE_DARK,
    flex: 1,
    textAlign: 'center',
  },

  placeholder: {
    width: 40, // Same width as back button for centering
  },

  // Scroll View Styles
  scrollView: {
    flex: 1,
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Notice Box
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.BLUE_LIGHT,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },

  noticeText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.BLUE_DARK,
    fontWeight: '500',
  },

  // Form Styles
  formGroup: {
    marginBottom: 20,
  },

  formGroupHalf: {
    flex: 1,
    marginHorizontal: 5,
  },

  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.BLUE_DARK,
  },

  input: {
    borderWidth: 1,
    borderColor: Colors.GRAY_LIGHT,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: Colors.WHITE,
    color: Colors.BLACK,
  },

  pickerContainer: {
    borderWidth: 1,
    borderColor: Colors.GRAY_LIGHT,
    borderRadius: 12,
    backgroundColor: Colors.WHITE,
    overflow: 'hidden',
  },

  picker: {
    height: 50,
    color: Colors.BLACK,
  },

  // Button Styles
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.GRAY_LIGHT,
  },

  cancelButton: {
    flex: 1,
    backgroundColor: Colors.GRAY_LIGHT,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 10,
  },

  saveButton: {
    flex: 1,
    backgroundColor: Colors.BLUE_DARK,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginLeft: 10,
  },

  disabledButton: {
    opacity: 0.6,
  },

  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.GRAY_DARK,
  },

  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.WHITE,
  },
});