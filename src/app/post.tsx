import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    Alert,
    Image,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import {
    savePost,
} from '../lib/postStorage';

import type {
    WorkoutPost,
} from '../lib/postStorage';

type SetItem = {
  id: number;
  weight: string;
  reps: string;
  completed: boolean;
};

type Exercise = {
  id: number;
  name: string;
  note: string;
  sets: SetItem[];
};

type WorkoutPayload = {
  id: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  exercises: Exercise[];
};

export default function PostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [caption, setCaption] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const workout = useMemo<WorkoutPayload | null>(() => {
    try {
      if (!params.workout) {
        return null;
      }

      const raw = Array.isArray(params.workout)
        ? params.workout[0]
        : params.workout;

      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [params.workout]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes} MIN`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}H ${remainingMinutes}M`;
  };

  const calculateVolume = (exercise: Exercise) => {
    return exercise.sets.reduce((total, set) => {
      const weight = Number(set.weight) || 0;
      const reps = Number(set.reps) || 0;

      return total + weight * reps;
    }, 0);
  };

  const totalVolume =
    workout?.exercises.reduce(
      (sum, exercise) =>
        sum + calculateVolume(exercise),
      0
    ) ?? 0;

  const totalSets =
    workout?.exercises.reduce(
      (sum, exercise) =>
        sum + exercise.sets.length,
      0
    ) ?? 0;

  const getBestSet = (exercise: Exercise) => {
    if (exercise.sets.length === 0) {
      return null;
    }

    return exercise.sets.reduce((best, set) => {
      const weight = Number(set.weight) || 0;
      const bestWeight = Number(best.weight) || 0;

      if (weight > bestWeight) {
        return set;
      }

      if (
        weight === bestWeight &&
        Number(set.reps) > Number(best.reps)
      ) {
        return set;
      }

      return best;
    });
  };

  const takePhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'CAMERA PERMISSION',
          'Camera access is required to take a post-workout photo.'
        );

        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 5],
          quality: 0.85,
        });

      if (!result.canceled) {
        setPhotoUri(
          result.assets[0].uri
        );
      }
    } catch {
      Alert.alert(
        'CAMERA ERROR',
        'Could not open the camera.'
      );
    }
  };

  const choosePhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'PHOTO PERMISSION',
          'Photo library access is required to choose an image.'
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 5],
          quality: 0.85,
        });

      if (!result.canceled) {
        setPhotoUri(
          result.assets[0].uri
        );
      }
    } catch {
      Alert.alert(
        'PHOTO ERROR',
        'Could not open the photo library.'
      );
    }
  };

  const openPhotoOptions = () => {
    Alert.alert(
      'ADD PHOTO',
      'Choose how you want to add your post-workout photo.',
      [
        {
          text: 'TAKE PHOTO',
          onPress: takePhoto,
        },
        {
          text: 'CHOOSE FROM LIBRARY',
          onPress: choosePhoto,
        },
        {
          text: 'CANCEL',
          style: 'cancel',
        },
      ]
    );
  };

  const removePhoto = () => {
    Alert.alert(
      'REMOVE PHOTO?',
      'Remove this photo from the post?',
      [
        {
          text: 'CANCEL',
          style: 'cancel',
        },
        {
          text: 'REMOVE',
          style: 'destructive',
          onPress: () =>
            setPhotoUri(null),
        },
      ]
    );
  };

  const handlePost = async () => {
    if (!workout || posting) {
      return;
    }

    const postExercises =
      workout.exercises.map(
        (exercise) => {
          const bestSet =
            getBestSet(exercise);

          return {
            id: exercise.id,
            name: exercise.name,
            bestWeight:
              Number(
                bestSet?.weight
              ) || 0,
            bestReps:
              Number(
                bestSet?.reps
              ) || 0,
            sets:
              exercise.sets.length,
            volume:
              calculateVolume(
                exercise
              ),
            note:
              exercise.note,
          };
        }
      );

    const post: WorkoutPost = {
      id: `${Date.now()}`,
      workoutId: workout.id,
      createdAt:
        new Date().toISOString(),

      caption:
        caption.trim(),

      photoUri,

      durationSeconds:
        workout.durationSeconds,

      totalSets,

      totalVolume,

      exercises:
        postExercises,
    };

    try {
      setPosting(true);

      await savePost(post);

      Alert.alert(
        'WORKOUT POSTED',
        'Your workout has been added to the LOADS feed.',
        [
          {
            text: 'VIEW FEED',
            onPress: () =>
              router.replace('/'),
          },
        ]
      );
    } catch {
      Alert.alert(
        'ERROR',
        'Could not save post.'
      );
    } finally {
      setPosting(false);
    }
  };

  const handleSaveWithoutPosting = () => {
    router.replace('/');
  };

  if (!workout) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View
          style={
            styles.errorContainer
          }
        >
          <Text
            style={
              styles.errorTitle
            }
          >
            NO WORKOUT DATA
          </Text>

          <Text
            style={
              styles.errorText
            }
          >
            The workout summary could
            not be loaded.
          </Text>

          <Pressable
            onPress={() =>
              router.replace(
                '/workout'
              )
            }
            style={
              styles.backButton
            }
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              BACK TO WORKOUT
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={styles.label}
        >
          WORKOUT COMPLETE
        </Text>

        <Text
          style={styles.title}
        >
          POST YOUR{'\n'}WORK.
        </Text>

        {photoUri ? (
          <View
            style={
              styles.photoWrapper
            }
          >
            <Image
              source={{
                uri: photoUri,
              }}
              style={styles.photo}
            />

            <View
              style={
                styles.photoActions
              }
            >
              <Pressable
                style={
                  styles.photoActionButton
                }
                onPress={
                  openPhotoOptions
                }
              >
                <Text
                  style={
                    styles.photoActionText
                  }
                >
                  CHANGE
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.photoActionButton
                }
                onPress={
                  removePhoto
                }
              >
                <Text
                  style={
                    styles.photoActionText
                  }
                >
                  REMOVE
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            style={
              styles.photoPlaceholder
            }
            onPress={
              openPhotoOptions
            }
          >
            <Text
              style={
                styles.photoPlus
              }
            >
              +
            </Text>

            <Text
              style={
                styles.photoText
              }
            >
              ADD POST-WORKOUT PHOTO
            </Text>

            <Text
              style={
                styles.photoSubtext
              }
            >
              TAKE PHOTO OR CHOOSE FROM
              LIBRARY
            </Text>
          </Pressable>
        )}

        <View
          style={
            styles.summaryCard
          }
        >
          <View
            style={
              styles.summaryTop
            }
          >
            <View>
              <Text
                style={
                  styles.summaryLabel
                }
              >
                SESSION
              </Text>

              <Text
                style={
                  styles.summaryValue
                }
              >
                {
                  workout.exercises
                    .length
                }{' '}
                EXERCISES
              </Text>
            </View>

            <View
              style={
                styles.summaryRight
              }
            >
              <Text
                style={
                  styles.summaryLabel
                }
              >
                TIME
              </Text>

              <Text
                style={
                  styles.summaryValue
                }
              >
                {formatDuration(
                  workout.durationSeconds
                )}
              </Text>
            </View>
          </View>

          <View
            style={styles.divider}
          />

          <View
            style={
              styles.metricRow
            }
          >
            <View>
              <Text
                style={
                  styles.metricLabel
                }
              >
                SETS
              </Text>

              <Text
                style={
                  styles.metricValue
                }
              >
                {totalSets}
              </Text>
            </View>

            <View
              style={
                styles.metricRight
              }
            >
              <Text
                style={
                  styles.metricLabel
                }
              >
                VOLUME
              </Text>

              <Text
                style={
                  styles.metricValue
                }
              >
                {totalVolume.toLocaleString()}
                kg
              </Text>
            </View>
          </View>
        </View>

        <Text
          style={
            styles.sectionTitle
          }
        >
          TODAY'S WORK
        </Text>

        {workout.exercises.map(
          (exercise) => {
            const bestSet =
              getBestSet(
                exercise
              );

            const volume =
              calculateVolume(
                exercise
              );

            return (
              <View
                key={exercise.id}
                style={
                  styles.exerciseCard
                }
              >
                <Text
                  style={
                    styles.exerciseName
                  }
                >
                  {exercise.name}
                </Text>

                {bestSet && (
                  <Text
                    style={
                      styles.bestSet
                    }
                  >
                    {
                      bestSet.weight
                    }
                    kg ×{' '}
                    {
                      bestSet.reps
                    }
                  </Text>
                )}

                <Text
                  style={
                    styles.exerciseMeta
                  }
                >
                  {
                    exercise.sets
                      .length
                  }{' '}
                  SETS ·{' '}
                  {volume.toLocaleString()}
                  kg VOLUME
                </Text>

                {exercise.note ? (
                  <Text
                    style={
                      styles.exerciseNote
                    }
                  >
                    {exercise.note}
                  </Text>
                ) : null}
              </View>
            );
          }
        )}

        <Text
          style={
            styles.sectionTitle
          }
        >
          CAPTION
        </Text>

        <TextInput
          value={caption}
          onChangeText={
            setCaption
          }
          placeholder="How was the work?"
          placeholderTextColor="#555"
          multiline
          maxLength={300}
          style={
            styles.captionInput
          }
        />

        <View
          style={
            styles.captionFooter
          }
        >
          <Text
            style={
              styles.captionHint
            }
          >
            OPTIONAL
          </Text>

          <Text
            style={
              styles.captionCount
            }
          >
            {caption.length}/300
          </Text>
        </View>

        <Pressable
          style={[
            styles.postButton,
            posting &&
              styles.postButtonDisabled,
          ]}
          onPress={handlePost}
          disabled={posting}
        >
          <Text
            style={
              styles.postButtonText
            }
          >
            {posting
              ? 'POSTING...'
              : 'POST WORKOUT'}
          </Text>
        </Pressable>

        <Pressable
          style={
            styles.skipButton
          }
          onPress={
            handleSaveWithoutPosting
          }
          disabled={posting}
        >
          <Text
            style={
              styles.skipButtonText
            }
          >
            SAVE WITHOUT POSTING
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#080808',
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 50,
    },

    label: {
      color: '#666',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 3,
    },

    title: {
      marginTop: 8,
      color: '#F5F5F2',
      fontSize: 46,
      lineHeight: 45,
      fontWeight: '900',
      letterSpacing: -1,
    },

    photoPlaceholder: {
      marginTop: 28,
      height: 280,
      backgroundColor:
        '#111',
      borderWidth: 1,
      borderColor:
        '#2A2A2A',
      borderStyle:
        'dashed',
      borderRadius: 14,
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal: 20,
    },

    photoPlus: {
      color: '#D9FF43',
      fontSize: 42,
      fontWeight: '300',
    },

    photoText: {
      marginTop: 10,
      color: '#AAA',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.5,
      textAlign: 'center',
    },

    photoSubtext: {
      marginTop: 7,
      color: '#555',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1,
      textAlign: 'center',
    },

    photoWrapper: {
      marginTop: 28,
    },

    photo: {
      width: '100%',
      aspectRatio: 4 / 5,
      borderRadius: 14,
      backgroundColor:
        '#111',
    },

    photoActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
    },

    photoActionButton: {
      flex: 1,
      backgroundColor:
        '#151515',
      borderWidth: 1,
      borderColor:
        '#252525',
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },

    photoActionText: {
      color: '#888',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    summaryCard: {
      marginTop: 18,
      backgroundColor:
        '#121212',
      borderWidth: 1,
      borderColor:
        '#242424',
      borderRadius: 12,
      padding: 18,
    },

    summaryTop: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
    },

    summaryRight: {
      alignItems: 'flex-end',
    },

    summaryLabel: {
      color: '#666',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    summaryValue: {
      marginTop: 4,
      color: '#F5F5F2',
      fontSize: 18,
      fontWeight: '900',
    },

    divider: {
      height: 1,
      backgroundColor:
        '#242424',
      marginVertical: 18,
    },

    metricRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
    },

    metricRight: {
      alignItems: 'flex-end',
    },

    metricLabel: {
      color: '#666',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    metricValue: {
      marginTop: 4,
      color: '#D9FF43',
      fontSize: 26,
      fontWeight: '900',
    },

    sectionTitle: {
      marginTop: 28,
      marginBottom: 10,
      color: '#777',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 2,
    },

    exerciseCard: {
      backgroundColor:
        '#111',
      borderWidth: 1,
      borderColor:
        '#222',
      borderRadius: 10,
      padding: 15,
      marginBottom: 10,
    },

    exerciseName: {
      color: '#F5F5F2',
      fontSize: 16,
      fontWeight: '900',
    },

    bestSet: {
      marginTop: 7,
      color: '#D9FF43',
      fontSize: 20,
      fontWeight: '900',
    },

    exerciseMeta: {
      marginTop: 5,
      color: '#777',
      fontSize: 11,
      fontWeight: '800',
    },

    exerciseNote: {
      marginTop: 10,
      color: '#999',
      fontSize: 12,
      lineHeight: 18,
    },

    captionInput: {
      minHeight: 105,
      backgroundColor:
        '#111',
      borderWidth: 1,
      borderColor:
        '#252525',
      borderRadius: 10,
      color: '#F5F5F2',
      padding: 14,
      textAlignVertical:
        'top',
      fontSize: 14,
      lineHeight: 20,
    },

    captionFooter: {
      marginTop: 7,
      flexDirection: 'row',
      justifyContent:
        'space-between',
    },

    captionHint: {
      color: '#444',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    captionCount: {
      color: '#555',
      fontSize: 9,
      fontWeight: '800',
    },

    postButton: {
      marginTop: 22,
      backgroundColor:
        '#D9FF43',
      paddingVertical: 18,
      borderRadius: 8,
      alignItems: 'center',
    },

    postButtonDisabled: {
      opacity: 0.5,
    },

    postButtonText: {
      color: '#080808',
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    skipButton: {
      marginTop: 12,
      paddingVertical: 15,
      alignItems: 'center',
    },

    skipButtonText: {
      color: '#666',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.3,
    },

    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      padding: 30,
    },

    errorTitle: {
      color: '#F5F5F2',
      fontSize: 20,
      fontWeight: '900',
    },

    errorText: {
      color: '#666',
      marginTop: 8,
      textAlign: 'center',
    },

    backButton: {
      marginTop: 20,
      backgroundColor:
        '#D9FF43',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 8,
    },

    backButtonText: {
      color: '#080808',
      fontWeight: '900',
    },
  });