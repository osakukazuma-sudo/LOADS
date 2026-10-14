import { postBestSummary, postSetSummary, postVolumeSummary, postPRLabel, postVolumeNote } from '../lib/postDisplay';
import { loadLabel } from '../lib/pr';
import { TrainingPartnerPicker, type TrainingPartner } from '../components/training-partner-picker';
import { setResultLabel } from '../lib/setResult';
import { cardioTotals } from '../lib/cardio';
import { buildPostExercises } from '../lib/workoutPost';
import { CardioSummaryCard } from '../components/cardio-summary-card';
import { useAccountOwner } from '../hooks/use-account-owner';
import {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
} from 'react';

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

import {
  useLocalSearchParams,
  useFocusEffect,
  useRouter,
} from 'expo-router';

import * as ImagePicker from 'expo-image-picker';

import {
  getWorkouts,
} from '../lib/workoutStorage';

import { currentUserId, prepareLocalPost, publishLocalPost } from '../lib/cloudPosts';
import type { LocalPost } from '../lib/postOutbox';
import { postErrorMessage } from '../lib/postValidation';

import type {
  WorkoutSession,
} from '../lib/workoutStorage';

import type {
  WorkoutPost,
  WorkoutPostExercise,
} from '../lib/postStorage';

  const formatTime = (
    totalSeconds: number
  ) => {
    const hours =
      Math.floor(
        totalSeconds / 3600
      );

    const minutes =
      Math.floor(
        (
          totalSeconds %
          3600
        ) / 60
      );

    const seconds =
      totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(
        minutes
      ).padStart(
        2,
        '0'
      )}:${String(
        seconds
      ).padStart(
        2,
        '0'
      )}`;
    }

    return `${minutes}:${String(
      seconds
    ).padStart(
      2,
      '0'
    )}`;
  };

export default function PostScreen() {
  const params = useLocalSearchParams<{ workout?: string }>();
  return <PostComposer key={params.workout ?? 'missing'} workoutParam={params.workout} />;
}

function PostComposer({ workoutParam }: { workoutParam?: string }) {
  const ownerId = useAccountOwner();
  const [trainingPartners, setTrainingPartners] = useState<TrainingPartner[]>([]);
  const router = useRouter();

  const [
    workout,
    setWorkout,
  ] =
    useState<WorkoutSession | null>(
      null
    );

  const [
    workoutHistory,
    setWorkoutHistory,
  ] =
    useState<WorkoutSession[]>([]);

  const [
    photoUri,
    setPhotoUri,
  ] =
    useState<string | null>(
      null
    );

  const [
    caption,
    setCaption,
  ] = useState('');

  const [
    posting,
    setPosting,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const draft = useRef<LocalPost | null>(null);
  const sending = useRef(false);
  const focused = useRef(false);
  const generation = useRef(0);
  const account = useRef<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; };
  }, []));

  // --------------------------------
  // LOAD
  // --------------------------------

  useEffect(() => {
    const request = ++generation.current;
    const initialize =
      async () => {
        try {
          if (
            typeof workoutParam !==
            'string'
          ) {
            return;
          }

          const parsed:
            WorkoutSession =
            JSON.parse(
              workoutParam
            );

          const userId = await currentUserId();
          if (request !== generation.current) return;
          account.current = userId;


          const history =
            await getWorkouts(ownerId);

          if (request === generation.current) {
            setWorkout(history.find(item => item.id === parsed.id) ?? null);
            setWorkoutHistory(history);
          }
        } catch (error) {
          console.error(
            'Failed to load post workout:',
            error
          );
        } finally {
          if (request === generation.current) setLoading(false);
        }
      };

    initialize();
    return () => { generation.current = request + 1; };
  }, [workoutParam, ownerId]);

  // --------------------------------
  // HELPERS
  // --------------------------------

  // --------------------------------
  // POST EXERCISES
  // --------------------------------

  const postExercises =
    useMemo<
      WorkoutPostExercise[]
    >(() => {
      if (!workout) {
        return [];
      }

      return buildPostExercises(workout, workoutHistory);
    }, [
      workout,
      workoutHistory,
    ]);

  const cardioStats = cardioTotals(postExercises);
  const volumeNote = postVolumeNote(postExercises);
  const hasMeasuredVolume = postExercises.some(e => e.type !== 'cardio' && e.loadType !== 'assisted' && e.loadType !== 'bodyweight');
  const classifiedPostingPaused = workout?.exercises.some(exercise => exercise.loadType !== undefined) ?? false;
  const totalSets =
    useMemo(() => {
      return postExercises.reduce(
        (
          total,
          exercise
        ) =>
          total +
          exercise.sets,
        0
      );
    }, [postExercises]);

  const totalVolume =
    useMemo(() => {
      return postExercises.reduce(
        (
          total,
          exercise
        ) =>
          total +
          exercise.volume,
        0
      );
    }, [postExercises]);

  const prCount =
    useMemo(() => {
      return postExercises.reduce(
        (
          total,
          exercise
        ) =>
          total +
          exercise.prTypes
            .length,
        0
      );
    }, [postExercises]);

  // --------------------------------
  // CAMERA
  // --------------------------------

  const takePhoto =
    async () => {
      if (sending.current || draft.current) return;
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          'CAMERA PERMISSION',
          'Camera access is required to take a photo.'
        );

        return;
      }

      const result =
        await ImagePicker.launchCameraAsync(
          {
            allowsEditing:
              true,

            aspect:
              [4, 5],

            quality:
              0.85,
          }
        );

      if (
        !result.canceled
      ) {
        setPhotoUri(
          result.assets[0]
            .uri
        );
      }
    };

  const choosePhoto =
    async () => {
      if (sending.current || draft.current) return;
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          'PHOTO PERMISSION',
          'Photo library access is required.'
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes:
              ['images'],

            allowsEditing:
              true,

            aspect:
              [4, 5],

            quality:
              0.85,
          }
        );

      if (
        !result.canceled
      ) {
        setPhotoUri(
          result.assets[0]
            .uri
        );
      }
    };

  // --------------------------------
  // POST
  // --------------------------------

  const handlePost = async () => {
    if (!workout || sending.current) return;
    if (workout.exercises.some(e => e.loadType)) { setPostError('Posting classified PULL UP is paused: older app versions cannot display assistance or bodyweight safely. Your workout is saved; COPY WORKOUT remains available in history.'); return; }
    sending.current = true;
    const request = generation.current;
    const valid = () => request === generation.current && focused.current;
    setPosting(true);
    setPostError(null);
    try {
      const userId = await currentUserId();
      if (userId !== account.current) throw new Error('Your account changed. Return to HOME before posting.');
      if (!draft.current) {
        const post: WorkoutPost = {
          id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14),
          workoutId: workout.id, createdAt: new Date().toISOString(),
          trainingPartners, caption: caption.trim(), photoUri, durationSeconds: workout.durationSeconds,
          totalSets, totalVolume, prCount, exercises: postExercises,
        };
        const entry = await prepareLocalPost(post, userId);
        if (request !== generation.current) return;
        draft.current = entry;
        setSaved(true);
      }
      await publishLocalPost(draft.current, 'post-composer');
      if (valid() && await currentUserId() === userId) router.replace('/');
    } catch (error) {
      if (valid()) setPostError(postErrorMessage(error));
    } finally {
      sending.current = false;
      if (request === generation.current) setPosting(false);
    }
  };

  const skipPost = () => {
    router.replace('/');
  };

  // --------------------------------
  // STATES
  // --------------------------------

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <View
          style={
            styles.centerState
          }
        >
          <Text
            style={
              styles.centerText
            }
          >
            LOADS
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <View
          style={
            styles.centerState
          }
        >
          <Text
            style={
              styles.centerText
            }
          >
            WORKOUT NOT FOUND
          </Text>

          <Pressable
            onPress={
              skipPost
            }
            style={
              styles.returnButton
            }
          >
            <Text
              style={
                styles.returnButtonText
              }
            >
              RETURN HOME
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.container
      }
    >
      <View
        style={
          styles.header
        }
      >
        <View>
          <Text
            style={
              styles.headerLabel
            }
          >
            WORK COMPLETE
          </Text>

          <Text
            style={
              styles.title
            }
          >
            POST WORKOUT
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        {prCount > 0 && (
          <View
            style={
              styles.prHero
            }
          >
            <Text
              style={
                styles.prHeroLabel
              }
            >
              SESSION RESULT
            </Text>

            <Text
              style={
                styles.prHeroNumber
              }
            >
              {prCount}
            </Text>

            <Text
              style={
                styles.prHeroText
              }
            >
              {prCount === 1
                ? 'PR TODAY'
                : 'PRS TODAY'}
            </Text>
          </View>
        )}

        <View
          style={
            styles.photoSection
          }
        >
          {photoUri ? (
            <>
              <Image
                source={{
                  uri:
                    photoUri,
                }}
                style={
                  styles.photo
                }
              />

              <View
                style={
                  styles.photoActions
                }
              >
                <Pressable
                  style={
                    styles.secondaryButton
                  }
                  onPress={
                    choosePhoto
                  }
                >
                  <Text
                    style={
                      styles.secondaryButtonText
                    }
                  >
                    CHANGE
                  </Text>
                </Pressable>

                <Pressable
                  style={
                    styles.secondaryButton
                  }
                  disabled={posting || saved}
                  onPress={() =>
                    setPhotoUri(
                      null
                    )
                  }
                >
                  <Text
                    style={
                      styles.removeText
                    }
                  >
                    REMOVE
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View
              style={
                styles.photoEmpty
              }
            >
              <Text
                style={
                  styles.photoEmptyLabel
                }
              >
                ADD TRAINING PHOTO
              </Text>

              <Text
                style={
                  styles.photoEmptyText
                }
              >
                Optional. The work
                still counts without
                it.
              </Text>

              <View
                style={
                  styles.photoButtonRow
                }
              >
                <Pressable
                  style={
                    styles.photoButton
                  }
                  onPress={
                    takePhoto
                  }
                >
                  <Text
                    style={
                      styles.photoButtonText
                    }
                  >
                    TAKE PHOTO
                  </Text>
                </Pressable>

                <Pressable
                  style={
                    styles.photoButton
                  }
                  onPress={
                    choosePhoto
                  }
                >
                  <Text
                    style={
                      styles.photoButtonText
                    }
                  >
                    LIBRARY
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View
          style={
            styles.summaryCard
          }
        >
          <View
            style={
              styles.summaryItem
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
              {formatTime(
                workout.durationSeconds
              )}
            </Text>
          </View>

          <View
            style={
              styles.summaryDivider
            }
          />

          <View
            style={
              styles.summaryItem
            }
          >
            <Text
              style={
                styles.summaryLabel
              }
            >
              {cardioStats.onlyCardio ? 'CARDIO' : 'SETS'}
            </Text>

            <Text
              style={
                styles.summaryValue
              }
            >
              {cardioStats.onlyCardio ? `${cardioStats.durationMinutes} min` : totalSets}
            </Text>
          </View>

          <View
            style={
              styles.summaryDivider
            }
          />

          <View
            style={
              styles.summaryItem
            }
          >
            <Text
              style={
                styles.summaryLabel
              }
            >
              {cardioStats.onlyCardio ? 'DISTANCE' : 'VOLUME'}
            </Text>

            <Text
              style={
                styles.summaryValue
              }
            >
              {cardioStats.onlyCardio ? cardioStats.distanceLabel : hasMeasuredVolume || !volumeNote ? `${totalVolume.toLocaleString()}kg` : '—'}
            </Text>
          </View>
        </View>

        <Text
          style={
            styles.sectionLabel
          }
        >
          WORK
        </Text>

        {postExercises.map(
          (exercise) => (
            exercise.type === 'cardio' && exercise.cardio ?
            <CardioSummaryCard key={exercise.id} name={loadLabel(exercise)} cardio={exercise.cardio} memo={exercise.note} /> :
            <View
              key={
                exercise.id
              }
              style={
                styles.exerciseCard
              }
            >
              <View
                style={
                  styles.exerciseHeader
                }
              >
                <View>
                  <Text
                    style={
                      styles.exerciseName
                    }
                  >
                    {loadLabel(exercise)}
                  </Text>

                  <Text
                    style={
                      styles.exerciseFocus
                    }
                  >
                    {
                      exercise.focus
                    }
                  </Text>
                </View>

                <Text
                  style={
                    styles.exerciseBest
                  }
                >
                  {postBestSummary(exercise)}
                </Text>
              </View>

              <View
                style={
                  styles.exerciseMeta
                }
              >
                {exercise.setResults?.filter(set => setResultLabel(set)).map((set, index) => <Text key={index} style={styles.exerciseMetaText}>{exercise.loadType ? postSetSummary(exercise, set.weight, set.reps) : `${set.weight}kg x ${set.reps}`} / {setResultLabel(set)}</Text>)}
                <Text
                  style={
                    styles.exerciseMetaText
                  }
                >
                  {exercise.sets}{' '}
                  SETS
                </Text>

                <Text
                  style={
                    styles.exerciseMetaText
                  }
                >
                  {postVolumeSummary(exercise)}{!exercise.loadType ? ' VOLUME' : ''}
                </Text>
              </View>

              {exercise.recordStatus === 'first' && <Text style={{ color: '#999999', borderWidth: 1, borderColor: '#666', padding: 8 }}>FIRST RECORD</Text>}
              {exercise.prTypes
                .length >
                0 && (
                <View
                  style={
                    styles.prRow
                  }
                >
                  {exercise.prTypes.map(
                    (
                      pr
                    ) => (
                      <View
                        key={pr}
                        style={
                          styles.prBadge
                        }
                      >
                        <Text
                          style={
                            styles.prBadgeText
                          }
                        >
                          {postPRLabel(exercise, pr)}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              )}
            </View>
          )
        )}

        <Text
          style={[
            styles.sectionLabel,
            {
              marginTop: 10,
            },
          ]}
        >
          CAPTION
        </Text>

        {!!volumeNote && <Text style={styles.exerciseMetaText}>{volumeNote}</Text>}
        <TrainingPartnerPicker owner={ownerId} selected={trainingPartners} onChange={setTrainingPartners} disabled={posting || saved} />
        <TextInput
          value={
            caption
          }
          onChangeText={
            setCaption
          }
          placeholder="Say something about the work..."
          placeholderTextColor="#555"
          multiline
          editable={!posting && !saved}
          maxLength={300}
          style={
            styles.captionInput
          }
        />

        <Text
          style={
            styles.captionCount
          }
        >
          {caption.length}/300
        </Text>

        {classifiedPostingPaused && <Text accessibilityRole="alert" style={{ color: '#FFB8A8', lineHeight: 20, marginVertical: 12 }}>
          Posting this workout is paused because older app versions cannot display classified PULL UP safely. Your workout is saved in History. Use COPY WORKOUT to share it.
        </Text>}
        {postError && <View style={{ paddingVertical: 12 }}>
          <Text accessibilityRole="alert" style={{ color: '#FFB8A8', lineHeight: 20 }}>{postError}</Text>
          <Text style={{ color: '#AAA', marginTop: 8 }}>
            {saved ? 'Saved on this device. Retry here or from HOME. The saved post is kept unchanged for safe retry.' : 'The post has not been saved yet. Your workout is still in History.'}
          </Text>
        </View>}
        <Pressable
          onPress={
            handlePost
          }
          disabled={
            posting || classifiedPostingPaused
          }
          style={[
            styles.postButton,

            (posting || classifiedPostingPaused) &&
              styles.disabledButton,
          ]}
        >
          <Text
            style={
              styles.postButtonText
            }
          >
            {classifiedPostingPaused ? 'POSTING UNAVAILABLE' : posting
              ? 'POSTING...'
              : saved ? 'RETRY POST' : 'POST WORKOUT'}
          </Text>
        </Pressable>

        <Pressable
          style={
            styles.skipButton
          }
          disabled={posting}
          onPress={
            skipPost
          }
        >
          <Text
            style={
              styles.skipButtonText
            }
          >
            {saved ? 'RETURN HOME — KEEP SAVED POST' : 'SAVE WITHOUT POSTING'}
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

    centerState: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    centerText: {
      color: '#999999',
      fontWeight:
        '900',
      letterSpacing: 2,
    },

    returnButton: {
      marginTop: 20,
      borderWidth: 1,
      borderColor:
        '#333',
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 8,
    },

    returnButtonText: {
      color:
        '#D9FF43',
      fontWeight:
        '900',
    },

    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1D1D1D',
    },

    headerLabel: {
      color:
        '#D9FF43',
      fontSize: 11,
      fontWeight:
        '900',
      letterSpacing: 2,
    },

    title: {
      color:
        '#F5F5F2',
      fontSize: 32,
      fontWeight:
        '900',
      marginTop: 4,
    },

    content: {
      padding: 16,
      paddingBottom: 50,
    },

    prHero: {
      backgroundColor:
        '#D9FF43',
      borderRadius: 12,
      padding: 18,
      marginBottom: 14,
    },

    prHeroLabel: {
      color:
        '#31390E',
      fontSize: 11,
      fontWeight:
        '900',
      letterSpacing: 1.5,
    },

    prHeroNumber: {
      color:
        '#080808',
      fontSize: 42,
      fontWeight:
        '900',
      marginTop: 2,
    },

    prHeroText: {
      color:
        '#080808',
      fontSize: 14,
      fontWeight:
        '900',
      letterSpacing: 1.5,
    },

    photoSection: {
      marginBottom: 14,
    },

    photo: {
      width: '100%',
      aspectRatio: 4 / 5,
      borderRadius: 12,
      backgroundColor:
        '#111',
    },

    photoActions: {
      flexDirection:
        'row',
      gap: 8,
      marginTop: 9,
    },

    secondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor:
        '#2D2D2D',
      borderRadius: 7,
      paddingVertical: 11,
      alignItems:
        'center',
    },

    secondaryButtonText: {
      color: '#AAA',
      fontSize: 11,
      fontWeight:
        '900',
    },

    removeText: {
      color: '#999999',
      fontSize: 11,
      fontWeight:
        '900',
    },

    photoEmpty: {
      backgroundColor:
        '#111111',
      borderWidth: 1,
      borderStyle:
        'dashed',
      borderColor:
        '#333',
      borderRadius: 12,
      padding: 24,
      alignItems:
        'center',
    },

    photoEmptyLabel: {
      color:
        '#F5F5F2',
      fontWeight:
        '900',
      letterSpacing: 1,
    },

    photoEmptyText: {
      color: '#999999',
      fontSize: 11,
      textAlign:
        'center',
      lineHeight: 17,
      marginTop: 6,
    },

    photoButtonRow: {
      flexDirection:
        'row',
      gap: 8,
      width: '100%',
      marginTop: 18,
    },

    photoButton: {
      flex: 1,
      backgroundColor:
        '#1B1B1B',
      borderWidth: 1,
      borderColor:
        '#2C2C2C',
      borderRadius: 8,
      paddingVertical: 13,
      alignItems:
        'center',
    },

    photoButtonText: {
      color:
        '#D9FF43',
      fontSize: 11,
      fontWeight:
        '900',
    },

    summaryCard: {
      flexDirection:
        'row',
      backgroundColor:
        '#111',
      borderWidth: 1,
      borderColor:
        '#242424',
      borderRadius: 10,
      paddingVertical: 16,
      marginBottom: 22,
    },

    summaryItem: {
      flex: 1,
      alignItems:
        'center',
    },

    summaryDivider: {
      width: 1,
      backgroundColor:
        '#252525',
    },

    summaryLabel: {
      color: '#999999',
      fontSize: 11,
      fontWeight:
        '900',
      letterSpacing: 1.2,
    },

    summaryValue: {
      color:
        '#F5F5F2',
      fontSize: 13,
      fontWeight:
        '900',
      marginTop: 5,
    },

    sectionLabel: {
      color: '#999999',
      fontSize: 11,
      fontWeight:
        '900',
      letterSpacing: 2,
      marginBottom: 9,
    },

    exerciseCard: {
      backgroundColor:
        '#111',
      borderWidth: 1,
      borderColor:
        '#242424',
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
    },

    exerciseHeader: {
      flexDirection:
        'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent:
        'space-between',
      alignItems:
        'flex-start',
    },

    exerciseName: {
      color:
        '#F5F5F2',
      fontSize: 16,
      fontWeight:
        '900',
    },

    exerciseFocus: {
      color: '#999999',
      fontSize: 11,
      fontWeight:
        '900',
      letterSpacing: 1.2,
      marginTop: 4,
    },

    exerciseBest: {
      flexShrink: 1,
      color:
        '#D9FF43',
      fontSize: 13,
      fontWeight:
        '900',
    },

    exerciseMeta: {
      flexDirection:
        'row',
      flexWrap: 'wrap',
      gap: 14,
      marginTop: 11,
    },

    exerciseMetaText: {
      color: '#999999',
      fontSize: 11,
      fontWeight:
        '800',
    },

    prRow: {
      flexDirection:
        'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 11,
    },

    prBadge: {
      backgroundColor:
        '#D9FF43',
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },

    prBadgeText: {
      color:
        '#080808',
      fontSize: 11,
      fontWeight:
        '900',
    },

    captionInput: {
      backgroundColor:
        '#111',
      borderWidth: 1,
      borderColor:
        '#292929',
      borderRadius: 10,
      minHeight: 110,
      color: '#DDD',
      padding: 14,
      textAlignVertical:
        'top',
      fontSize: 14,
    },

    captionCount: {
      textAlign:
        'right',
      color: '#999999',
      fontSize: 11,
      marginTop: 5,
    },

    postButton: {
      backgroundColor:
        '#D9FF43',
      borderRadius: 8,
      paddingVertical: 18,
      alignItems:
        'center',
      marginTop: 18,
    },

    disabledButton: {
      opacity: 0.5,
    },

    postButtonText: {
      color:
        '#080808',
      fontWeight:
        '900',
      letterSpacing: 1.3,
    },

    skipButton: {
      alignItems:
        'center',
      paddingVertical: 18,
    },

    skipButtonText: {
      color: '#999999',
      fontSize: 11,
      fontWeight:
        '900',
      letterSpacing: 1.1,
    },
  });
