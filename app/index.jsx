import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from "expo-router";
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Colors from "../constant/Colors";

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Hero Image with Gradient Overlay */}
      <View style={styles.imageContainer}>
        <Image
          source={require('../assets/images/start.jpg')}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(16, 26, 83, 0.1)', 'rgba(16, 26, 83, 1)']}
          style={styles.gradientOverlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </View>

      {/* Content Section */}
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Welcome to SmartHydrate!</Text>
        <Text style={styles.subtitle}>Your smart companion for staying perfectly hydrated, every day.</Text>

        {/* Action Buttons */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => router.push('/auth/signUp')}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, styles.primaryButtonText]}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.push('/auth/signIn')}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Already have an Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.WHITE,
  },
  imageContainer: {
    width: '100%',
    height: height * 0.55,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: 'rgb(16, 26, 83)',
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
  },
  title: {
    color: Colors.WHITE,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  buttonGroup: {
    marginTop: 20,
    gap: 16,
  },
  button: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.BLACK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButton: {
    backgroundColor: Colors.WHITE,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.WHITE,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButtonText: {
    color: 'rgb(16, 26, 83)',
  },
  secondaryButtonText: {
    color: Colors.WHITE,
  },
});