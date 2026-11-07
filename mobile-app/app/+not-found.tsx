import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, FontWeight, Fonts, Spacing } from '../constants/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>This screen doesn't exist.</Text>
      <Link href="/" style={styles.link}>
        Back to the dashboard
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  link: {
    marginTop: Spacing.lg,
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },
});
