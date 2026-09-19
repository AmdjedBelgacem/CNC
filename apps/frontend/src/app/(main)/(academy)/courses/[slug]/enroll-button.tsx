'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle } from 'lucide-react';
interface EnrollButtonProps {
  courseId: string;
}
export function EnrollButton({ courseId }: EnrollButtonProps) {
  const [enrolling, setEnrolling] = useState(false);
  const [localEnrolled, setLocalEnrolled] = useState(false);
  const { isAuthenticated, hydrated } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: async () => {
      const res = await fetch('/api/proxy/courses/enrollments/mine', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && hydrated,
    staleTime: 30_000,
  });
  const isEnrolledFromServer = Array.isArray(enrollments)
    ? enrollments.some((e: any) => (e.courseId || e.course?.id) === courseId)
    : false;
  const enrolled = localEnrolled || isEnrolledFromServer;
  const isCheckingEnrollment = isAuthenticated && hydrated && enrollmentsLoading;
  const handleEnroll = async () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    setEnrolling(true);
    try {
      const res = await fetch('/api/proxy/courses/enroll', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });
      if (res.ok) {
        setLocalEnrolled(true);
        queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
        queryClient.invalidateQueries({ queryKey: ['course-progress', courseId] });
      }
    } finally {
      setEnrolling(false);
    }
  };
  if (enrolled) {
    return (
      <Button className="w-full" variant="secondary" disabled>
        {' '}
        <CheckCircle className="mr-2 h-4 w-4" /> Enrolled{' '}
      </Button>
    );
  }
  return (
    <Button className="w-full" onClick={handleEnroll} disabled={enrolling || isCheckingEnrollment}>
      {' '}
      {enrolling || isCheckingEnrollment ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : null}{' '}
      {isAuthenticated ? 'Enroll Now' : 'Sign In to Enroll'}{' '}
    </Button>
  );
}
