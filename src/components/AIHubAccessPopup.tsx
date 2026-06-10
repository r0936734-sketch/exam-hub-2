import { useEffect, useState } from "react";
import { X, MessageCircle, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getAIHubPassReminderStatusServerFn,
  markAIHubPassReceivedServerFn,
} from "@/services/aihub-pass.functions";

const TARGET_STUDENTS = ["STU018", "STU019", "STU025"];

export function AIHubAccessPopup({
  userId,
  userName,
  token,
}: {
  userId: string;
  userName: string;
  token: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReminderStatus() {
      if (!TARGET_STUDENTS.includes(userId) || !token) {
        setOpen(false);
        setShouldShow(false);
        return;
      }

      try {
        const status = await getAIHubPassReminderStatusServerFn({ data: { token } });
        if (cancelled) return;

        setShouldShow(status.shouldShow);
        setOpen(status.shouldShow);
      } catch {
        if (cancelled) return;
        setOpen(false);
        setShouldShow(false);
      }
    }

    loadReminderStatus();

    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  const handleOpenTelegram = () => {
    window.open("https://t.me/Sitaaram1001", "_blank");
  };

  const askPassReceived = () => {
    setOpen(false);
    setConfirmOpen(true);
  };

  const handlePassReceived = async () => {
    setSaving(true);
    try {
      await markAIHubPassReceivedServerFn({ data: { token } });
      setShouldShow(false);
      setConfirmOpen(false);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleStillNeedPass = () => {
    setConfirmOpen(false);
  };

  if (!TARGET_STUDENTS.includes(userId) || !shouldShow) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : askPassReceived())}>
        <DialogContent className="max-w-md border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-6 w-6 text-blue-600" />
              AI Hub Access Ready!
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-700">
                Hi <span className="font-semibold">{userName}</span>,
              </p>
              <p className="mt-2 text-sm text-gray-600">
                You've been selected for AI Hub access.
              </p>
            </div>

            <Alert className="border-amber-200 bg-amber-50">
              <AlertDescription className="text-sm text-amber-900">
                <p className="mb-2 font-semibold">What's next:</p>
                <ul className="list-inside list-disc space-y-1 text-xs">
                  <li>You have exclusive AI-powered exam preparation</li>
                  <li>Get personalized questions and instant feedback</li>
                  <li>Track your progress in real time</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Alert className="border-cyan-200 bg-cyan-50">
              <AlertDescription className="flex items-start gap-2 text-sm">
                <MessageCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-600" />
                <div>
                  <p className="font-semibold text-cyan-900">Get your passcode</p>
                  <p className="mt-1 text-xs text-cyan-800">
                    DM <span className="font-mono font-bold">@Sitaram1001</span> on Telegram to receive your personal passcode.
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={askPassReceived}>
                Close
              </Button>
              <Button
                onClick={handleOpenTelegram}
                className="flex-1 gap-2 bg-cyan-500 hover:bg-cyan-600"
              >
                <MessageCircle className="h-4 w-4" />
                Contact on Telegram
              </Button>
            </div>
          </div>

          <button
            onClick={askPassReceived}
            className="absolute right-4 top-4 rounded-md hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Already got your AI Hub pass?</AlertDialogTitle>
            <AlertDialogDescription>
              Click yes only if you have received your personal AI Hub pass. Once saved, this popup will not show again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStillNeedPass} disabled={saving}>
              Not yet
            </AlertDialogCancel>
            <AlertDialogAction onClick={handlePassReceived} disabled={saving}>
              {saving ? "Saving..." : "Yes, I got it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
