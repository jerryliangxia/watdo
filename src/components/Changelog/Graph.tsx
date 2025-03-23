"use client";

import { useEffect, useState } from "react";
import styles from "../../styles/components/graph.module.css";
import Tooltip from "./Tooltip";
import { useWindupString, WindupChildren, Pace, Pause } from "windups";
import logbook from "./logbook.json";
import Link from "next/link";

interface CommitDay {
  date: string;
  count: number;
}

interface MonthGroup {
  month: string;
  days: CommitDay[];
}

interface LogEntry {
  id: number;
  date: string;
  text: string;
}

interface DisplayDate {
  hour: number;
  addCount?: number;
}

const getDisplayDates = (): DisplayDate[] => {
  // Create hours from 11AM to 10AM next day (24 hours)
  const hours = [];

  // Start with 11AM
  for (let i = 11; i <= 23; i++) {
    hours.push({
      hour: i,
      addCount: Math.floor(Math.random() * 10), // Random contribution count
    });
  }

  // Then 0AM to 10AM next day
  for (let i = 0; i <= 10; i++) {
    hours.push({
      hour: i,
      addCount: Math.floor(Math.random() * 10), // Random contribution count
    });
  }

  return hours;
};

const parseText = (text: string) => {
  const lines = text.split(/\n/);

  return lines.map((line, lineIndex) => {
    const linkParts = line.split(/(\[\[.*?\]\])/);

    const processedLine = linkParts.map((part, index) => {
      if (part.startsWith("[[") && part.endsWith("]]")) {
        const [url, label] = part.slice(2, -2).split("|");
        return (
          <Link
            key={`${lineIndex}-link-${index}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            {label}
          </Link>
        );
      }

      const decoratedParts = part.split(/(__.*?__)/);
      const processedParts = decoratedParts.map((text, dIndex) => {
        if (text.startsWith("__") && text.endsWith("__")) {
          const innerText = text.slice(2, -2);
          return (
            <span
              key={`${lineIndex}-decorated-${index}-${dIndex}`}
              className={styles.underline}
            >
              {innerText}
            </span>
          );
        }

        const sentences = text.split(/(\.\s+|\.$|,\s*)/);
        return sentences.map((sentence, sIndex) => {
          if (sentence.match(/\.\s*$/)) {
            return [
              sentence,
              <Pause
                key={`pause-${lineIndex}-${index}-${dIndex}-${sIndex}`}
                ms={300}
              />,
            ];
          }
          if (sentence.match(/,\s*$/)) {
            return [
              sentence,
              <Pause
                key={`pause-${lineIndex}-${index}-${dIndex}-${sIndex}`}
                ms={100}
              />,
            ];
          }
          return sentence;
        });
      });

      return processedParts;
    });

    return [
      ...processedLine,
      lineIndex < lines.length - 1 && <br key={`br-${lineIndex}`} />,
    ];
  });
};

export default function Graph() {
  const [hourlyCommits, setHourlyCommits] = useState<DisplayDate[]>([]);
  const [daysSinceLaunch, setDaysSinceLaunch] = useState<number>(2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentEntry, setCurrentEntry] = useState<string>("");
  const [entries, setEntries] = useState<LogEntry[]>([]);

  // Format hour to display AM/PM
  const formatHour = (hour: number) => {
    if (hour === 0) return "12AM";
    if (hour < 12) return `${hour}AM`;
    if (hour === 12) return "12PM";
    return `${hour - 12}PM`;
  };

  useEffect(() => {
    // Generate random commit data instead of fetching
    const displayDates = getDisplayDates();
    setHourlyCommits(displayDates);
    setLoading(false);
  }, []);

  useEffect(() => {
    const sortedEntries = [...logbook.entries].sort((a, b) => b.id - a.id);
    setEntries(sortedEntries);
  }, []);

  useEffect(() => {
    const latestEntry = logbook.entries[logbook.entries.length - 1];
    if (latestEntry) {
      setCurrentEntry(latestEntry.text);
    }
  }, []);

  const getIntensityClass = (count: number) => {
    if (count === 0) return styles.intensityNone;
    if (count <= 3) return styles.intensityLow;
    if (count <= 6) return styles.intensityMedium;
    return styles.intensityHigh;
  };

  const formatDateMMDD = (dateStr: string) => {
    const [, month, day] = dateStr.split("-");
    return `${month}-${day}`;
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className={styles.graphWrapper}>
      <div className={styles.header}>
        <div className={styles.monthLabel}>Mar 23, 2025</div>
        <div className={styles.startDate}>Day {daysSinceLaunch}</div>
      </div>
      <div className={styles.graphContainer}>
        <div className={styles.monthGroup}>
          <div className={styles.monthDays}>
            {hourlyCommits.map((hourData) => (
              <div key={hourData.hour} className={styles.commitColumn}>
                <Tooltip content={`${hourData.addCount} contributions`}>
                  <div className={styles.commitWrapper}>
                    <div
                      className={`${styles.commitDay} ${getIntensityClass(
                        hourData.addCount || 0
                      )}`}
                    />
                  </div>
                </Tooltip>
                <div className={styles.dateLabel}>
                  {formatHour(hourData.hour)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.logEntries}>
        {entries.map((entry, index) => (
          <div key={entry.id} className={styles.logEntry}>
            <span className={styles.logDate}>{formatDateMMDD(entry.date)}</span>
            {index === 0 ? (
              <p className={styles.typingText}>
                <WindupChildren>
                  <Pace ms={18}>{parseText(entry.text)}</Pace>
                </WindupChildren>
              </p>
            ) : (
              <p className={styles.logText}>{parseText(entry.text)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
