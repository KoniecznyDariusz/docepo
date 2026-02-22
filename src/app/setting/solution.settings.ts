export class SolutionSettings {
  static getAvailableStatuses(): string[] {
    return ['', 'C', 'G', 'W', 'U', 'P', 'N'];
  }

  static getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      '': '-',
      'C': 'C',
      'G': 'G',
      'W': 'W',
      'U': 'U',
      'P': 'P',
      'N': 'N'
    };
    return labels[status] || '?';
  }

  static getStatusBadgeColor(status: string): string {
    switch (status) {
      case 'G':
        return 'bg-green-300';
      case 'W':
        return 'bg-green-400';
      case 'U':
        return 'bg-green-600';
      case 'P':
        return 'bg-green-700';
      case 'N':
        return 'bg-red-500';
      case 'C':
        return 'bg-yellow-400';
      default:
        return 'bg-gray-500';
    }
  }

  static getStatusTextColor(status: string): string {
    switch (status) {
      case 'G':
        return 'text-green-300';
      case 'W':
        return 'text-green-400';
      case 'U':
        return 'text-green-600';
      case 'P':
        return 'text-green-700';
      case 'N':
        return 'text-red-500';
      case 'C':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  }

  static getSolutionFillColor(points: number, maxPoints: number): string {
    if (maxPoints <= 0) return 'rgb(71, 85, 105)'; // slate-600
    const percentage = (points / maxPoints) * 100;

    if (percentage === 100) return 'rgb(34, 197, 94)';     // green-500
    if (percentage > 80) return 'rgb(134, 239, 172)';      // light green-400
    if (percentage === 80) return 'rgb(249, 115, 22)';     // orange-500
    if (percentage > 50) return 'rgb(254, 215, 170)';      // light orange-300
    if (percentage === 50) return 'rgb(234, 179, 8)';      // yellow-500
    return 'rgb(239, 68, 68)';                              // red-500
  }

  static getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      '': '- Not graded / Nie ocenione',
      'C': 'C - Comment / Komentarz (coś trzeba poprawić)',
      'G': 'G - Graded / Ocenione - czekam na plik',
      'W': 'W - Warning / Ostrzeżenie o braku pliku',
      'U': 'U - Uploaded / Plik przesłany do ePortalu',
      'P': 'P - Positive / Pozytywnie zakończone',
      'N': 'N - Negative / Nie rozwiązane'
    };
    return descriptions[status] || descriptions[''];
  }
}